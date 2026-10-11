import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CHANNEL_HEADER, SIGNATURE_HEADER, sign, TIMESTAMP_HEADER } from '../../common/crypto/signature.js';
import { addDays, enumerateNights } from '../../common/time/stay-dates.js';
import { type Env, parseChannelSecrets } from '../../config/env.validation.js';
import type { SimulationResultResponseDto, SimulationRunResponseDto } from './dto/simulation-response.dto.js';
import { SimulationRun } from './simulation-run.entity.js';
import { problem } from '../../common/http/problem.js';

export interface RunInput {
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  prepareRemaining?: number;
  requestCount: number;
  notifyRatio: number;
  duplicateRatio: number;
}

interface PlannedRequest {
  channelCode: string;
  body: string;
  duplicate: boolean;
}

interface CalendarRow {
  roomTypeId: number;
  code: string;
  days: { stayDate: string; total: number | null; sold: number | null; available: number | null }[];
}

// 동시 예약 시뮬레이터 (REQ-19). 경계: Restella와는 HTTP 계약으로만 주고받는다 (back-end/README.md "시뮬레이터의 경계")
// - 예약: 채널별 키로 서명해 채널 API로 보낸다
// - 준비·검증: 실행한 운영자의 토큰으로 운영자 API를 부른다
@Injectable()
export class SimulatorService {
  private readonly target: string;
  private readonly secrets: Map<string, string>;

  constructor(
    @InjectRepository(SimulationRun) private readonly runs: Repository<SimulationRun>,
    config: ConfigService<Env, true>,
  ) {
    this.target = config.get('SIMULATOR_TARGET_URL', { infer: true });
    this.secrets = parseChannelSecrets(config.get('CHANNEL_SECRETS_JSON', { infer: true }));
  }

  async run(input: RunInput, authorization: string): Promise<SimulationRunResponseDto> {
    const nights = enumerateNights(input.checkIn, input.checkOut);
    if (nights.length === 0) throw problem('validation', 'checkOut은 checkIn보다 뒤여야 한다');
    const api = (method: string, path: string, body?: unknown) => this.operatorApi(authorization, method, path, body);

    const roomTypes = (await api('GET', '/api/v1/room-types')) as { id: number; code: string }[];
    const roomType = roomTypes.find((r) => r.id === input.roomTypeId);
    if (!roomType) throw problem('unknown-room-type');
    const channels = (await api('GET', '/api/v1/channels')) as { code: string; type: 'CONFIRM' | 'NOTIFY'; active: boolean }[];
    const confirmChannels = channels.filter((c) => c.active && c.type === 'CONFIRM' && this.secrets.has(c.code)).map((c) => c.code);
    const notifyChannels = channels.filter((c) => c.active && c.type === 'NOTIFY' && this.secrets.has(c.code)).map((c) => c.code);
    if (confirmChannels.length === 0 || notifyChannels.length === 0) {
      throw problem('validation', '확인형과 통보형 채널이 각각 하나 이상 있어야 한다');
    }

    const run = await this.runs.save(
      this.runs.create({
        roomTypeId: input.roomTypeId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        requestCount: input.requestCount,
        notifyRatio: input.notifyRatio,
        duplicateRatio: input.duplicateRatio,
        prepareRemaining: input.prepareRemaining ?? null,
        startedAt: new Date(),
      }),
    );

    // 1) 준비: 숙박일마다 남은 재고를 prepareRemaining으로 맞춘다 (운영자 API로 총 재고 조정)
    if (input.prepareRemaining !== undefined) {
      const before = await this.calendar(api, input.checkIn, nights);
      const target = before.find((r) => r.roomTypeId === roomType.id)!;
      for (const day of target.days) {
        if (day.sold === null) continue; // 재고 미등록 날짜는 건드리지 않는다
        await api('PATCH', `/api/v1/inventory/${roomType.id}/${day.stayDate}`, {
          totalRooms: day.sold + input.prepareRemaining,
          source: `SIMULATOR:${run.id}`,
        });
      }
    }

    // 2) 요청 만들기: 비율은 중복을 뺀 고유 요청 기준이다
    const duplicates = Math.round((input.requestCount * input.duplicateRatio) / 100);
    const unique = input.requestCount - duplicates;
    const notifyCount = Math.round((unique * input.notifyRatio) / 100);
    const planned: PlannedRequest[] = [];
    for (let i = 0; i < unique; i++) {
      const notify = i < notifyCount;
      const pool = notify ? notifyChannels : confirmChannels;
      const channelCode = pool[i % pool.length];
      planned.push({
        channelCode,
        duplicate: false,
        body: JSON.stringify({
          channelReservationNo: `SIM${run.id}-${String(i + 1).padStart(3, '0')}`,
          roomTypeCode: roomType.code,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestName: `시뮬레이션 손님 ${i + 1}`,
        }),
      });
    }
    for (let i = 0; i < duplicates; i++) planned.push({ ...planned[i % unique], duplicate: true });
    shuffle(planned);

    // 3) 동시에 보낸다
    const startedAt = Date.now();
    const responses = await Promise.all(planned.map((p) => this.sendReservation(p)));
    const durationMs = Date.now() - startedAt;

    const tally = { confirmed: 0, rejected: 0, conflicts: 0, duplicates: 0, errors: 0 };
    for (const r of responses) {
      if (r.replayed) tally.duplicates++;
      else if (r.result === 'CONFIRMED') tally.confirmed++;
      else if (r.result === 'REJECTED') tally.rejected++;
      else if (r.result === 'CONFLICT') tally.conflicts++;
      else tally.errors++;
    }

    // 4) 검증: 실행 후 모든 객실타입·숙박일에서 판매 수 ≤ 총 재고 (AC-19-2)
    const after = await this.calendar(api, input.checkIn, nights);
    const checked = after.flatMap((rt) =>
      rt.days.filter((d) => d.total !== null).map((d) => ({ roomTypeCode: rt.code, ...d })),
    );
    const overbooked = checked.filter((d) => (d.sold ?? 0) > (d.total ?? 0));
    const targetDays = after.find((r) => r.roomTypeId === roomType.id)!.days;

    const result: SimulationResultResponseDto = {
      ...tally,
      requests: input.requestCount,
      uniqueRequests: unique,
      notifyRequests: notifyCount,
      confirmRequests: unique - notifyCount,
      durationMs,
      invariantOk: overbooked.length === 0,
      overbookedNights: overbooked.length,
      nights: targetDays,
    };
    run.result = result;
    run.finishedAt = new Date();
    await this.runs.update({ id: run.id }, { result, finishedAt: run.finishedAt });
    return toRunResponse(run);
  }

  async list(limit: number): Promise<SimulationRunResponseDto[]> {
    const runs = await this.runs.find({ order: { id: 'DESC' }, take: limit });
    return runs.map(toRunResponse);
  }

  async get(id: number): Promise<SimulationRunResponseDto> {
    const run = await this.runs.findOneBy({ id });
    if (!run) throw problem('not-found', '실행 기록이 없다');
    return toRunResponse(run);
  }

  private async sendReservation(p: PlannedRequest): Promise<{ result?: string; replayed: boolean }> {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const res = await fetch(`${this.target}/api/v1/channel/reservations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CHANNEL_HEADER]: p.channelCode,
          [TIMESTAMP_HEADER]: String(timestamp),
          [SIGNATURE_HEADER]: sign(this.secrets.get(p.channelCode)!, timestamp, p.body),
        },
        body: p.body,
      });
      const body = (await res.json()) as { result?: string };
      return { result: res.status === 200 || res.status === 409 ? body.result : undefined, replayed: res.headers.get('idempotent-replayed') === 'true' };
    } catch {
      return { replayed: false };
    }
  }

  private async calendar(api: (m: string, p: string) => Promise<unknown>, checkIn: string, nights: string[]): Promise<CalendarRow[]> {
    const last = nights.at(-1) ?? addDays(checkIn, 0);
    return (await api('GET', `/api/v1/inventory?from=${checkIn}&to=${last}`)) as CalendarRow[];
  }

  private async operatorApi(authorization: string, method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${this.target}${path}`, {
      method,
      headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw problem('upstream-failed', `운영자 API ${method} ${path} 실패: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

function toRunResponse(run: SimulationRun): SimulationRunResponseDto {
  return {
    id: run.id,
    roomTypeId: run.roomTypeId,
    checkIn: run.checkIn,
    checkOut: run.checkOut,
    prepareRemaining: run.prepareRemaining,
    requestCount: run.requestCount,
    notifyRatio: run.notifyRatio,
    duplicateRatio: run.duplicateRatio,
    result: run.result,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}
