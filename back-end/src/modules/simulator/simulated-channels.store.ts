import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';

export interface ChannelFault {
  failureRate: number; // 0~1, 재고 동기화 수신을 실패(503)로 응답할 확률
  delayMs: number; // 응답 지연
}

export interface ReceivedAvailability {
  roomTypeCode: string;
  stayDate: string;
  available: number;
  stopSell: boolean;
  revision: number;
  receivedAt: string;
}

// 가짜 채널들이 받은 값을 기억한다 (메모리). 실제 채널처럼 이미 받은 revision보다 오래된 값은 무시한다 (AC-12-3)
@Injectable()
export class SimulatedChannelsStore {
  private readonly availability = new Map<string, Map<string, ReceivedAvailability>>();
  private readonly cancellations = new Map<string, { channelReservationNo: string; receivedAt: string }[]>();
  private faults = new Map<string, ChannelFault>();
  staleIgnored = 0;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('SIMULATOR_FAULTS_JSON', { infer: true });
    if (raw) this.setFaults(JSON.parse(raw) as Record<string, Partial<ChannelFault>>);
  }

  /** 받은 값을 반영한다. 더 오래된 revision이면 무시하고 false를 돌려준다 */
  receiveAvailability(channelCode: string, msg: Omit<ReceivedAvailability, 'receivedAt'>): boolean {
    const byKey = this.availability.get(channelCode) ?? new Map<string, ReceivedAvailability>();
    const key = `${msg.roomTypeCode}|${msg.stayDate}`;
    const current = byKey.get(key);
    if (current && current.revision >= msg.revision) {
      this.staleIgnored += 1;
      return false;
    }
    byKey.set(key, { ...msg, receivedAt: new Date().toISOString() });
    this.availability.set(channelCode, byKey);
    return true;
  }

  receiveCancellation(channelCode: string, channelReservationNo: string): void {
    const list = this.cancellations.get(channelCode) ?? [];
    list.push({ channelReservationNo, receivedAt: new Date().toISOString() });
    this.cancellations.set(channelCode, list);
  }

  snapshot() {
    return {
      availability: Object.fromEntries([...this.availability].map(([code, m]) => [code, [...m.values()]])),
      cancellations: Object.fromEntries(this.cancellations),
      faults: Object.fromEntries(this.faults),
      staleIgnored: this.staleIgnored,
    };
  }

  /** 가짜 채널들이 받은 값을 지운다 (데모 초기화·테스트 격리용). 장애 주입 설정은 유지한다 */
  reset(): void {
    this.availability.clear();
    this.cancellations.clear();
    this.staleIgnored = 0;
  }

  faultFor(channelCode: string): ChannelFault {
    return this.faults.get(channelCode) ?? { failureRate: 0, delayMs: 0 };
  }

  setFaults(faults: Record<string, Partial<ChannelFault>>): void {
    this.faults = new Map(
      Object.entries(faults).map(([code, f]) => [
        code,
        { failureRate: Math.min(1, Math.max(0, f.failureRate ?? 0)), delayMs: Math.max(0, f.delayMs ?? 0) },
      ]),
    );
  }
}
