import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RECEIVE_RESULTS, type ReceiveResult } from '../reservation.entity.js';

export class ReceiveReservationResponseDto {
  reservationId: number;

  /** CONFIRMED: 확정, REJECTED: 확인형 채널 매진 거절(409), CONFLICT: 통보형 채널 매진 → 오버부킹 충돌 */
  @ApiProperty({ enum: RECEIVE_RESULTS })
  result: ReceiveResult;

  /** 거절 사유. REJECTED일 때만 있다 */
  @ApiPropertyOptional({ enum: ['SOLD_OUT'] })
  reason?: 'SOLD_OUT';
}

export class ChannelCancelResponseDto {
  reservationId: number;

  @ApiProperty({ enum: ['CANCELLED'] })
  status: 'CANCELLED';
}
