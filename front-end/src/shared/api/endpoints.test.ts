import { describe, expect, it } from 'vitest';
import { endpoints, toUrl } from './endpoints';

describe('endpoints', () => {
  it('경로 변수는 path, 쿼리 문자열은 params로 만든다', () => {
    expect(toUrl(endpoints.inventoryAdjust, { path: [3, '2026-10-10'] })).toBe('/inventory/3/2026-10-10');
    expect(toUrl(endpoints.reservationList, { params: { status: 'CONFLICT', from: '2026-10-10', cursor: undefined } })).toBe(
      '/reservations?status=CONFLICT&from=2026-10-10',
    );
  });

  it('배열은 쉼표로 잇는다 (이벤트 유형 필터)', () => {
    expect(toUrl(endpoints.eventList, { params: { type: ['RESERVATION_CONFLICT', 'SYNC_FAILED'], cursor: 120 } })).toBe(
      '/events?type=RESERVATION_CONFLICT%2CSYNC_FAILED&cursor=120',
    );
  });

  it('메서드는 정의에서 정해진다', () => {
    expect(endpoints.conflictResolve.method).toBe('POST');
    expect(endpoints.channelFaultsUpdate.method).toBe('PUT');
  });
});
