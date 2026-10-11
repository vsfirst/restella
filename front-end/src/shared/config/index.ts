/** 콘솔 상단 메뉴 */
export const NAV_ITEMS = [
  { href: '/inventory', label: '재고' },
  { href: '/reservations', label: '예약' },
  { href: '/conflicts', label: '충돌' },
  { href: '/events', label: '이벤트' },
  { href: '/simulator', label: '시뮬레이터' },
] as const;

/** 재고 달력 기본 기간 (일). back-end는 최대 31일까지 받는다 (AC-02-1) */
export const CALENDAR_DAYS = 14;
export const MAX_RANGE_DAYS = 31;

/** SSE가 끊겼을 때 보조 폴링 간격 (ADR-0004) */
export const FALLBACK_POLL_MS = 10_000;
