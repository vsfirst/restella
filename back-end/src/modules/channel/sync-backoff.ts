// 동기화 실패 시 재시도 간격: 1초, 2초, 4초, 8초. 최대 5회 시도 (AC-12-1)
export const MAX_SYNC_ATTEMPTS = 5;

/** attempts = 지금까지 실패한 횟수(1부터). 다음 시도까지 기다릴 시간(ms). 더 시도하지 않으면 null */
export function nextRetryDelayMs(attempts: number): number | null {
  if (attempts >= MAX_SYNC_ATTEMPTS) return null;
  return 1_000 * 2 ** (attempts - 1);
}
