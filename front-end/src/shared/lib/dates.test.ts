import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, enumerateDates, formatDateTime, formatStay, isDateString, todayInSeoul, weekdayLabel } from './dates';

describe('dates (NFR-08: 숙박일은 서울 기준 YYYY-MM-DD)', () => {
  it('서울 기준 오늘: UTC 15시 이후는 다음 날이다', () => {
    expect(todayInSeoul(new Date('2026-10-09T14:59:59Z'))).toBe('2026-10-09');
    expect(todayInSeoul(new Date('2026-10-09T15:00:00Z'))).toBe('2026-10-10');
  });

  it('날짜 계산은 월·연도 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-10', '2026-10-12')).toBe(2);
    expect(enumerateDates('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('없는 날짜와 형식이 틀린 값은 거른다', () => {
    expect(isDateString('2026-10-10')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-1-1')).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });

  it('표시 형식: 요일, 숙박, 서울 시각(밀리초)', () => {
    expect(weekdayLabel('2026-10-10')).toBe('토');
    expect(formatStay('2026-10-10', '2026-10-12')).toBe('10-10 → 10-12 (2박)');
    expect(formatDateTime('2026-10-09T05:31:05.412Z')).toBe('2026-10-09 14:31:05.412');
  });
});
