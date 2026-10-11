import { IsString } from 'class-validator';

/** Restella → 채널 취소 통보 계약 (docs/2-design/api.md). 가짜 채널이 받는 쪽이다 */
export class ReceiveCancellationRequestDto {
  @IsString()
  channelReservationNo: string;

  @IsString()
  reason: string;
}
