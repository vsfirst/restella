/** 쿼리 문자열. 값이 없는 항목은 빼고, 배열은 쉼표로 잇는다 */
export function toSearch(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** cursor 방식 목록 응답 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
