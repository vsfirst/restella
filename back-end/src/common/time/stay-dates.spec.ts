import { addDays, daysBetween, enumerateNights, isCalendarDate, todayInSeoul } from './stay-dates.js';

describe('enumerateNights (REQ-01)', () => {
  it('AC-01-1: 체크아웃 날짜는 숙박일에 넣지 않는다', () => {
    expect(enumerateNights('2026-10-10', '2026-10-12')).toEqual(['2026-10-10', '2026-10-11']);
  });

  it('월과 해를 넘긴다', () => {
    expect(enumerateNights('2026-12-31', '2027-01-02')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('AC-01-2: 체크아웃이 체크인과 같거나 빠르면 숙박일이 없다', () => {
    expect(enumerateNights('2026-10-10', '2026-10-10')).toEqual([]);
    expect(enumerateNights('2026-10-10', '2026-10-09')).toEqual([]);
  });

  it('존재하지 않는 날짜는 거절한다', () => {
    expect(() => enumerateNights('2026-02-30', '2026-03-02')).toThrow(RangeError);
  });
});

describe('날짜 유틸', () => {
  it('isCalendarDate', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-1-01')).toBe(false);
  });

  it('addDays, daysBetween', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-10', '2026-11-09')).toBe(30);
  });

  it('NFR-08: 서버 시간대와 무관하게 서울 날짜를 계산한다', () => {
    // UTC 2026-10-09 15:30 = KST 2026-10-10 00:30
    expect(todayInSeoul(new Date('2026-10-09T15:30:00Z'))).toBe('2026-10-10');
  });
});
