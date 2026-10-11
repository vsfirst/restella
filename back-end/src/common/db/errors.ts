// MariaDB 오류 번호 판별
const ER_DUP_ENTRY = 1062;
const ER_CONSTRAINT_FAILED = 4025; // CHECK 제약 위반

function errno(err: unknown): number | undefined {
  const e = err as { errno?: number; driverError?: { errno?: number } };
  return e?.driverError?.errno ?? e?.errno;
}

export const isDuplicateKey = (err: unknown): boolean => errno(err) === ER_DUP_ENTRY;
export const isCheckViolation = (err: unknown): boolean => errno(err) === ER_CONSTRAINT_FAILED;

const ER_LOCK_DEADLOCK = 1213;
const ER_LOCK_WAIT_TIMEOUT = 1205;

export const isRetryableLockError = (err: unknown): boolean => {
  const n = errno(err);
  return n === ER_LOCK_DEADLOCK || n === ER_LOCK_WAIT_TIMEOUT;
};

/**
 * 교착·잠금 대기 시간 초과면 트랜잭션 전체를 다시 시도한다 (MariaDB 권고: "try restarting transaction").
 * 정상 흐름에서는 잠금 순서가 고정돼 교착이 없지만, 같은 키를 먼저 INSERT한 트랜잭션이 롤백되면
 * 그 키를 기다리던 트랜잭션들끼리 교착이 날 수 있다 (InnoDB의 알려진 동작).
 */
export async function withLockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isRetryableLockError(err)) throw err;
      await new Promise((r) => setTimeout(r, 10 * i + Math.random() * 20));
    }
  }
}
