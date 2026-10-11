import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RESERVATION_STATUSES, type ReservationStatus } from '../reservation.entity.js';

export class ListReservationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  channelId?: number;

  @ApiPropertyOptional({ enum: RESERVATION_STATUSES })
  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;

  /** 숙박 기간이 [from, to]와 겹치는 예약 (YYYY-MM-DD) */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

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
