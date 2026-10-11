import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHANNEL_HEADER, SIGNATURE_HEADER, sign, TIMESTAMP_HEADER } from '../../common/crypto/signature.js';
import type { Env } from '../../config/env.validation.js';

export interface AvailabilityMessage {
  roomTypeCode: string;
  stayDate: string;
  available: number;
  stopSell: boolean;
  revision: number;
}

export interface CancellationMessage {
  channelReservationNo: string;
  reason: string;
}

const TIMEOUT_MS = 3_000;

// Restella → 채널 요청 (docs/2-design/api.md "채널 동기화"). 실제 OTA 연동 시 이 클래스만 바꾸면 된다.
@Injectable()
export class ChannelGateway {
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('OUTBOUND_SIGNING_SECRET', { infer: true });
  }

  sendAvailability(channelCode: string, endpointUrl: string, message: AvailabilityMessage): Promise<void> {
    return this.post(channelCode, `${endpointUrl}/availability`, message);
  }

  sendCancellation(channelCode: string, endpointUrl: string, message: CancellationMessage): Promise<void> {
    return this.post(channelCode, `${endpointUrl}/cancellations`, message);
  }

  private async post(channelCode: string, url: string, message: object): Promise<void> {
    const body = JSON.stringify(message);
    const timestamp = Math.floor(Date.now() / 1000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CHANNEL_HEADER]: channelCode,
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: sign(this.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`채널 응답 ${res.status}`);
  }
}
