import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CONFLICT_STATUSES, type ConflictStatus } from '../conflict.entity.js';

export class ListConflictsQueryDto {
  @ApiPropertyOptional({ enum: CONFLICT_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(CONFLICT_STATUSES)
  status: ConflictStatus = 'OPEN';

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
