import { IsDateString } from 'class-validator';
import { daysBetween, isCalendarDate } from '../time/stay-dates.js';
import { problem } from './problem.js';

export const MAX_RANGE_DAYS = 31; // AC-02-1

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (양 끝 포함, 최대 31일) */
export class DateRangeQueryDto {
  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;

  assertRange(): void {
    if (!isCalendarDate(this.from) || !isCalendarDate(this.to)) throw problem('validation', '날짜는 YYYY-MM-DD 형식이어야 한다');
    const days = daysBetween(this.from, this.to) + 1;
    if (days < 1) throw problem('validation', 'to는 from보다 빠를 수 없다');
    if (days > MAX_RANGE_DAYS) throw problem('validation', `기간은 최대 ${MAX_RANGE_DAYS}일이다`);
  }
}
