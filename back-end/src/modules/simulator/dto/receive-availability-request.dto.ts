import { IsBoolean, IsDateString, IsInt, IsString, Min } from 'class-validator';

/** Restella → 채널 재고 동기화 계약 (docs/2-design/api.md). 가짜 채널이 받는 쪽이다 */
export class ReceiveAvailabilityRequestDto {
  @IsString()
  roomTypeCode: string;

  @IsDateString({ strict: true })
  stayDate: string;

  @IsInt()
  @Min(0)
  available: number;

  @IsBoolean()
  stopSell: boolean;

  @IsInt()
  @Min(1)
  revision: number;
}
