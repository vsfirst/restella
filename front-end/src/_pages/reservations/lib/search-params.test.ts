import { describe, expect, it } from 'vitest';
import { parseReservationParams } from './search-params';

describe('parseReservationParams', () => {
  it('형식이 맞는 값만 필터로 쓴다', () => {
    expect(parseReservationParams({ status: 'CONFLICT', from: '2026-10-10', to: '2026-02-30', channelId: '3', id: '12' })).toEqual({
      filters: { channelId: 3, status: 'CONFLICT', from: '2026-10-10', to: undefined },
      cursor: undefined,
      selectedId: 12,
    });
    expect(parseReservationParams({ status: 'DROP TABLE', channelId: '1;' }).filters).toEqual({
      channelId: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
    });
  });
});
