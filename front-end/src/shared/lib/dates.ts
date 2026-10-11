// 숙박일은 'YYYY-MM-DD' 문자열로만 다룬다. 기준 시간대는 Asia/Seoul이다 (NFR-08)
const TIME_ZONE = 'Asia/Seoul';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** 서울 기준 오늘 */
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** from부터 to까지 (양 끝 포함) */
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0=일 … 6=토 */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function weekdayLabel(date: string): string {
  return WEEKDAYS[weekday(date)];
}

/** '10-17' */
export function monthDay(date: string): string {
  return date.slice(5);
}

/** '10-17 (토)' */
export function monthDayWithWeekday(date: string): string {
  return `${monthDay(date)} (${weekdayLabel(date)})`;
}

/** '10-10 → 10-12 (2박)' */
export function formatStay(checkIn: string, checkOut: string): string {
  return `${monthDay(checkIn)} → ${monthDay(checkOut)} (${daysBetween(checkIn, checkOut)}박)`;
}

const DATE_TIME = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hourCycle: 'h23',
});

/** '2026-10-09 14:31:05.412' (서울 시각). 서버와 브라우저가 같은 문자열을 만든다 */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso)).replace(',', '.');
}

/** '14:31:05' */
export function formatTime(iso: string): string {
  return formatDateTime(iso).slice(11, 19);
}
