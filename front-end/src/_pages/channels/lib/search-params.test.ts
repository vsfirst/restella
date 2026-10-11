import { describe, expect, it } from 'vitest';
import { parseChannelParams } from './search-params';

describe('parseChannelParams', () => {
  it('모르는 객실타입이면 마지막 객실타입, 날짜가 틀리면 오늘', () => {
    expect(parseChannelParams({ roomTypeId: '9', from: 'x' }, '2026-10-10', [1, 2, 3])).toEqual({ from: '2026-10-10', roomTypeId: 3 });
    expect(parseChannelParams({ roomTypeId: '2', from: '2026-11-09' }, '2026-10-10', [1, 2, 3])).toEqual({ from: '2026-11-09', roomTypeId: 2 });
  });
});
