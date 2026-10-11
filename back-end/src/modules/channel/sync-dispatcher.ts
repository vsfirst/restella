import { type BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { MetricsService } from '../../common/metrics/metrics.service.js';
import type { EventInput } from '../event-log/event-log.service.js';
import { EventLogService } from '../event-log/event-log.service.js';
import { RealtimeService } from '../event-log/realtime.service.js';
import { ChannelGateway } from './channel.gateway.js';
import { MAX_SYNC_ATTEMPTS, nextRetryDelayMs } from './sync-backoff.js';

interface DueRow {
  channel_id: string;
  room_type_id: string;
  stay_date: string;
  desired_available: number;
  desired_revision: string;
  attempts: number;
  changed_at: Date;
  channel_code: string;
  endpoint_url: string;
  room_type_code: string;
}

const BATCH_SIZE = 200;
const CONCURRENCY = 20;

// channel_availability에서 보내야 할 값을 골라 채널에 보낸다 (REQ-11, 12. ADR-0004 결정 3)
// 1초마다 돌고, 예약 처리 직후에는 kick()으로 바로 깨운다. 노드가 1대라 발송기도 하나만 돈다.
@Injectable()
export class SyncDispatcher implements BeforeApplicationShutdown {
  private readonly logger = new Logger(SyncDispatcher.name);
  private running: Promise<void> | null = null;
  private rerun = false;
  private stopped = false;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly gateway: ChannelGateway,
    private readonly events: EventLogService,
    private readonly realtime: RealtimeService,
    private readonly metrics: MetricsService,
  ) {}

  @Interval(1_000)
  tick(): void {
    void this.run();
  }

  kick(): void {
    void this.run();
  }

  /** 한 번에 하나만 돈다. 도는 중에 다시 불리면 끝난 뒤 한 번 더 돈다 */
  run(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** 종료 전에 진행 중인 전송을 끝낸다. DB 연결이 먼저 닫히지 않게 한다 (Pod 재시작 시) */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    await this.running;
  }

  private async loop(): Promise<void> {
    try {
      do {
        this.rerun = false;
        await this.dispatchDue();
      } while (this.rerun && !this.stopped);
    } catch (err) {
      this.logger.error(err instanceof Error ? err.stack : String(err));
    }
  }

  private async dispatchDue(): Promise<void> {
    const due: DueRow[] = await this.ds.query(
      `SELECT ca.channel_id, ca.room_type_id, ca.stay_date, ca.desired_available, ca.desired_revision,
              ca.attempts, ca.changed_at, c.code AS channel_code, c.endpoint_url, rt.code AS room_type_code
         FROM channel_availability ca
         JOIN channel c ON c.id = ca.channel_id AND c.active = 1
         JOIN room_type rt ON rt.id = ca.room_type_id
        WHERE ca.desired_revision > ca.sent_revision
          AND ca.attempts < ?
          AND ca.next_attempt_at <= ?
        ORDER BY ca.changed_at
        LIMIT ?`,
      [MAX_SYNC_ATTEMPTS, new Date(), BATCH_SIZE],
    );
    if (due.length === 0) return;

    const succeeded = new Map<string, { roomTypeId: number; stayDate: string; revision: number; channels: string[]; maxLatencyMs: number }>();
    const failures: EventInput[] = [];

    for (let i = 0; i < due.length; i += CONCURRENCY) {
      await Promise.all(
        due.slice(i, i + CONCURRENCY).map(async (row) => {
          const ok = await this.deliver(row);
          if (ok === true) {
            const latencyMs = Date.now() - new Date(row.changed_at).getTime();
            const key = `${row.room_type_id}|${row.stay_date}|${row.desired_revision}`;
            const group = succeeded.get(key) ?? {
              roomTypeId: Number(row.room_type_id),
              stayDate: row.stay_date,
              revision: Number(row.desired_revision),
              channels: [],
              maxLatencyMs: 0,
            };
            group.channels.push(row.channel_code);
            group.maxLatencyMs = Math.max(group.maxLatencyMs, latencyMs);
            succeeded.set(key, group);
          } else if (ok) {
            failures.push(ok);
          }
        }),
      );
    }

    // 성공은 숙박일·revision 단위로 묶어서 기록한다. 채널마다 남기면 이벤트 로그가 넘친다
    const events: EventInput[] = [...succeeded.values()].map((g) => ({
      type: 'SYNC_SUCCEEDED',
      actor: 'SYSTEM',
      roomTypeId: g.roomTypeId,
      detail: { stayDate: g.stayDate, revision: g.revision, channels: g.channels, maxLatencyMs: g.maxLatencyMs },
    }));
    events.push(...failures);
    if (events.length > 0) {
      await this.events.record(this.ds.manager, events);
      this.realtime.publish({ topic: 'sync.changed' });
    }
  }

  /** 성공하면 true, 실패하면 기록할 이벤트, 이미 더 최신 값이 나간 경우 null */
  private async deliver(row: DueRow): Promise<true | EventInput | null> {
    const revision = Number(row.desired_revision);
    const pk = [row.channel_id, row.room_type_id, row.stay_date];
    try {
      await this.gateway.sendAvailability(row.channel_code, row.endpoint_url, {
        roomTypeCode: row.room_type_code,
        stayDate: row.stay_date,
        available: row.desired_available,
        stopSell: row.desired_available === 0,
        revision,
      });
      const now = new Date();
      // sent_revision은 줄어들지 않는다. 늦게 끝난 오래된 전송이 최신 기록을 덮지 않게 한다
      await this.ds.query(
        `UPDATE channel_availability
            SET sent_available = ?, sent_revision = ?, sent_at = ?, attempts = 0, last_error = NULL
          WHERE channel_id = ? AND room_type_id = ? AND stay_date = ? AND sent_revision < ?`,
        [row.desired_available, revision, now, ...pk, revision],
      );
      this.metrics.syncLatency.observe((now.getTime() - new Date(row.changed_at).getTime()) / 1000);
      return true;
    } catch (err) {
      const attempts = row.attempts + 1;
      const delay = nextRetryDelayMs(attempts);
      const message = err instanceof Error ? err.message : String(err);
      // 그 사이 더 최신 값이 기록되었으면(재시도 횟수 초기화됨) 이 실패는 기록하지 않는다
      const res: { affectedRows?: number } = await this.ds.query(
        `UPDATE channel_availability
            SET attempts = ?, next_attempt_at = ?, last_error = ?
          WHERE channel_id = ? AND room_type_id = ? AND stay_date = ? AND desired_revision = ?`,
        [attempts, new Date(Date.now() + (delay ?? 0)), message.slice(0, 500), ...pk, revision],
      );
      if (!res.affectedRows) return null;
      this.metrics.syncFailures.inc({ channel: row.channel_code, final: String(delay === null) });
      return {
        type: 'SYNC_FAILED',
        actor: 'SYSTEM',
        channelId: Number(row.channel_id),
        roomTypeId: Number(row.room_type_id),
        detail: {
          channel: row.channel_code,
          stayDate: row.stay_date,
          revision,
          attempt: attempts,
          maxAttempts: MAX_SYNC_ATTEMPTS,
          error: message,
          nextRetryInMs: delay,
        },
      };
    }
  }
}
