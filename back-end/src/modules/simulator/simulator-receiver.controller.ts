import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { setTimeout as sleep } from 'node:timers/promises';
import { Public } from '../../common/auth/public.decorator.js';
import { ReceiveAvailabilityRequestDto } from './dto/receive-availability-request.dto.js';
import { ReceiveCancellationRequestDto } from './dto/receive-cancellation-request.dto.js';
import { OutboundSignatureGuard } from './outbound-signature.guard.js';
import { SimulatedChannelsStore } from './simulated-channels.store.js';
import { problem } from '../../common/http/problem.js';

// 가짜 채널의 수신 주소 (Restella → 채널). Ingress에 노출하지 않는다 (docs/2-design/api.md)
@ApiExcludeController()
@Public()
@Controller('internal/simulator/channels')
export class SimulatorReceiverController {
  constructor(private readonly store: SimulatedChannelsStore) {}

  @Post(':code/availability')
  @HttpCode(200)
  @UseGuards(OutboundSignatureGuard)
  async availability(@Param('code') code: string, @Body() body: ReceiveAvailabilityRequestDto) {
    await this.injectFault(code);
    const applied = this.store.receiveAvailability(code, body);
    return { applied };
  }

  @Post(':code/cancellations')
  @HttpCode(200)
  @UseGuards(OutboundSignatureGuard)
  async cancellation(@Param('code') code: string, @Body() body: ReceiveCancellationRequestDto) {
    await this.injectFault(code);
    this.store.receiveCancellation(code, body.channelReservationNo);
    return { received: true };
  }

  /** 가짜 채널들이 받은 상태 (테스트·디버깅용, 비공개) */
  @Get()
  snapshot() {
    return this.store.snapshot();
  }

  private async injectFault(code: string): Promise<void> {
    const fault = this.store.faultFor(code);
    if (fault.delayMs > 0) await sleep(fault.delayMs);
    if (fault.failureRate > 0 && Math.random() < fault.failureRate) {
      throw problem('service-unavailable', `시뮬레이터 장애 주입: ${code}`);
    }
  }
}
