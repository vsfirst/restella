import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { safeNext } = await import('./auth');

describe('safeNext (로그인 뒤 이동 경로)', () => {
  it('같은 사이트 경로만 허용한다', () => {
    expect(safeNext('/conflicts?status=OPEN')).toBe('/conflicts?status=OPEN');
    expect(safeNext('//evil.example')).toBeUndefined();
    expect(safeNext('/\\evil.example')).toBeUndefined();
    expect(safeNext('https://evil.example')).toBeUndefined();
    expect(safeNext(undefined)).toBeUndefined();
  });
});
