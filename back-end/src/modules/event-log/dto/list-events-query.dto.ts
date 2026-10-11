import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EVENT_TYPES, type EventType } from '../event-log.entity.js';

export class ListEventsQueryDto {
  /** 유형 필터. 쉼표로 여러 개를 줄 수 있다 */
  @ApiPropertyOptional({ enum: EVENT_TYPES, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) => (Array.isArray(value) ? value : value.split(',')))
  @IsIn(EVENT_TYPES, { each: true })
  type?: EventType[];

  /** 이전 응답의 nextCursor */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
