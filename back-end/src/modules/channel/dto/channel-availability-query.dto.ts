import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/http/date-range-query.dto.js';

export class ChannelAvailabilityQueryDto extends DateRangeQueryDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  roomTypeId: number;
}
