import { describe, expect, it } from 'vitest';
import type { EventLog } from '../api/types';
import { describeEvent } from './describe-event';

const base = { id: 1, occurredAt: '2026-10-09T05:31:05.412Z', actor: 'CHANNEL:OTA_B', reservationId: 7, channelId: 4, roomTypeId: 3 };
const event = (type: EventLog['type'], detail: Record<string, unknown>): EventLog => ({ ...base, type, detail });

describe('describeEvent', () => {
  it('통보형 매진은 충돌로 기록했다고 쓴다', () => {
    const text = describeEvent(
      event('RESERVATION_CONFLICT', { channelReservationNo: 'OTA-B-7781', roomTypeCode: 'FAM-STE', checkIn: '2026-10-10', checkOut: '2026-10-11', soldOutDates: ['2026-10-10'] }),
    );
    expect(text).toBe('OTA-B-7781 · FAM-STE 10-10 → 10-11 (1박) 매진(10-10), 통보형이라 충돌로 기록');
  });

  it('확정은 남은 재고를 함께 쓴다', () => {
    const text = describeEvent(
      event('RESERVATION_CONFIRMED', { channelReservationNo: 'D-1', roomTypeCode: 'FAM-STE', checkIn: '2026-10-10', checkOut: '2026-10-11', remaining: { '2026-10-10': 0 } }),
    );
    expect(text).toContain('확정, 남은 재고 10-10 0');
  });

  it('detail에 객실타입 코드가 없으면 id로 찾는다', () => {
    const text = describeEvent(event('SYNC_SUCCEEDED', { stayDate: '2026-10-10', revision: 3, channels: ['DIRECT', 'OTA_A'], maxLatencyMs: 12 }), (id) =>
      id === 3 ? 'FAM-STE' : undefined,
    );
    expect(text).toBe('2개 채널 · FAM-STE 10-10 남은 재고 전송, 최대 지연 12ms');
  });

  it('중복 요청은 처음 결과로 응답했다고 쓴다', () => {
    expect(describeEvent(event('RESERVATION_DUPLICATE', { channelReservationNo: 'D-1', initialResult: 'CONFIRMED' }))).toBe(
      'D-1 재전송 → 처음 결과(확정)로 응답, 재고 변화 없음',
    );
  });
});
