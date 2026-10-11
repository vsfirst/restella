import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RunSimulationRequestDto {
  @IsInt()
  @Min(1)
  roomTypeId: number;

  /** 체크인 (YYYY-MM-DD) */
  @IsDateString({ strict: true })
  checkIn: string;

  /** 체크아웃 (YYYY-MM-DD) */
  @IsDateString({ strict: true })
  checkOut: string;

  /** 실행 전에 숙박일마다 남은 재고를 이 값으로 맞춘다. 없으면 현재 재고 그대로 실행한다 */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  prepareRemaining?: number;

  /** 동시에 보낼 요청 수 (중복 포함) */
  @IsInt()
  @Min(1)
  @Max(100)
  requestCount: number;

  /** 고유 요청 중 통보형 채널(OTA) 비율 (%) */
  @IsInt()
  @Min(0)
  @Max(100)
  notifyRatio: number;

  /** 전체 요청 중 같은 예약번호를 다시 보내는 중복 요청 비율 (%) */
  @IsInt()
  @Min(0)
  @Max(50)
  duplicateRatio: number;
}
