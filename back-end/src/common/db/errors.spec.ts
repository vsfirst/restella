import { isDuplicateKey, withLockRetry } from './errors.js';

const dbError = (errno: number) => Object.assign(new Error(`errno ${errno}`), { driverError: { errno } });

describe('withLockRetry', () => {
  it('교착(1213)이면 다시 시도한다', async () => {
    let calls = 0;
    const result = await withLockRetry(async () => {
      calls++;
      if (calls < 3) throw dbError(1213);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('최대 횟수를 넘으면 마지막 오류를 던진다', async () => {
    await expect(withLockRetry(async () => Promise.reject(dbError(1205)), 2)).rejects.toThrow('errno 1205');
  });

  it('잠금 오류가 아니면 바로 던진다', async () => {
    let calls = 0;
    await expect(
      withLockRetry(async () => {
        calls++;
        throw dbError(1062);
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('isDuplicateKey', () => {
    expect(isDuplicateKey(dbError(1062))).toBe(true);
    expect(isDuplicateKey(dbError(1213))).toBe(false);
  });
});
