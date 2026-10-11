// 숙박일 계산. 날짜는 'YYYY-MM-DD' 문자열(Asia/Seoul 기준 달력 날짜)로만 다루고 시각을 섞지 않는다 (NFR-08).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 체크인부터 체크아웃 전날까지의 숙박일. 10-10 → 10-12면 ['10-10', '10-11'] (REQ-01) */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
  if (!isCalendarDate(checkIn) || !isCalendarDate(checkOut)) {
    throw new RangeError('날짜는 YYYY-MM-DD 형식이어야 한다');
  }
  const nights: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) nights.push(d);
  return nights;
}

/** 오늘의 서울 날짜 */
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

/** 두 날짜 사이의 일수 (to - from) */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
