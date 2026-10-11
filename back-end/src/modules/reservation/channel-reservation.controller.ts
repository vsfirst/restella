import { Body, Controller, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiConflictResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/auth/public.decorator.js';
import { CHANNEL_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '../../common/crypto/signature.js';
import { ChannelSignatureGuard } from '../channel/channel-signature.guard.js';
import type { Channel } from '../channel/channel.entity.js';
import { VerifiedChannel } from '../channel/channel.decorator.js';
import { ChannelCancelResponseDto, ReceiveReservationResponseDto } from './dto/channel-reservation-response.dto.js';
import { ReceiveReservationRequestDto } from './dto/receive-reservation-request.dto.js';
import { ReservationService } from './reservation.service.js';

// 채널 API (채널 → Restella). 운영자 토큰 대신 채널별 HMAC 서명으로 보호한다 (REQ-09)
@ApiTags('channel API')
@ApiHeader({ name: CHANNEL_HEADER, required: true })
@ApiHeader({ name: TIMESTAMP_HEADER, required: true })
@ApiHeader({ name: SIGNATURE_HEADER, required: true })
@Public()
@UseGuards(ChannelSignatureGuard)
@Controller('api/v1/channel/reservations')
export class ChannelReservationController {
  constructor(private readonly reservations: ReservationService) {}

  /** 확정·충돌은 200, 확인형 매진 거절은 409. 같은 요청이 다시 오면 처음과 같은 응답 (docs/2-design/api.md) */
  @Post()
  @ApiOkResponse({ type: ReceiveReservationResponseDto, description: '확정(CONFIRMED) 또는 통보형 채널의 충돌(CONFLICT)' })
  @ApiConflictResponse({ type: ReceiveReservationResponseDto, description: '확인형 채널 매진 거절(REJECTED, reason=SOLD_OUT)' })
  async receive(
    @VerifiedChannel() channel: Channel,
    @Body() body: ReceiveReservationRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReceiveReservationResponseDto> {
    const outcome = await this.reservations.receive(channel, body);
    if (outcome.replayed) res.setHeader('Idempotent-Replayed', 'true');
    if (outcome.result === 'REJECTED') {
      res.status(409);
      return { reservationId: outcome.reservationId, result: outcome.result, reason: 'SOLD_OUT' };
    }
    res.status(200);
    return { reservationId: outcome.reservationId, result: outcome.result };
  }

  @Post(':channelReservationNo/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: ChannelCancelResponseDto })
  async cancel(@VerifiedChannel() channel: Channel, @Param('channelReservationNo') no: string): Promise<ChannelCancelResponseDto> {
    const r = await this.reservations.cancelByChannel(channel, no);
    return { reservationId: r.reservationId, status: r.status };
  }
}
