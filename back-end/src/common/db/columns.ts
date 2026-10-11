import type { ValueTransformer } from 'typeorm';

// BIGINT는 드라이버가 문자열로 돌려줄 수 있어 숫자로 바꾼다. 값 범위는 2^53 안이다.
export const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) => (value === null ? null : Number(value)),
};
