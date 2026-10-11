import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdjustInventoryRequestDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  totalRooms: number;

  /** 조정을 일으킨 출처. 예: 시뮬레이터가 실행 전에 남은 재고를 맞출 때 "SIMULATOR:12" */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}
