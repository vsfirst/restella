import { MAX_SYNC_ATTEMPTS, nextRetryDelayMs } from './sync-backoff.js';

describe('동기화 재시도 간격 (AC-12-1)', () => {
  it('간격을 두 배씩 늘린다', () => {
    expect([1, 2, 3, 4].map(nextRetryDelayMs)).toEqual([1_000, 2_000, 4_000, 8_000]);
  });

  it('최대 5회 시도한 뒤에는 멈춘다', () => {
    expect(nextRetryDelayMs(MAX_SYNC_ATTEMPTS)).toBeNull();
  });
});
