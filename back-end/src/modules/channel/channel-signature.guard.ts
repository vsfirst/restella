import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { CHANNEL_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from '../../common/crypto/signature.js';
import type { Channel } from './channel.entity.js';
import { ChannelService } from './channel.service.js';
import { problem } from '../../common/http/problem.js';

export interface ChannelRequest {
  headers: Record<string, string | undefined>;
  rawBody?: Buffer;
  channel?: Channel;
}

// 채널 웹훅 요청의 HMAC 서명을 검사한다 (REQ-09).
// 서명은 "요청 헤더에 적힌 채널"의 키로 검증하므로, 다른 채널의 키로 이 채널을 사칭할 수 없다 (AC-09-2).
@Injectable()
export class ChannelSignatureGuard implements CanActivate {
  constructor(private readonly channels: ChannelService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ChannelRequest>();
    const code = req.headers[CHANNEL_HEADER];
    const secret = code ? this.channels.secretFor(code) : undefined;
    const channel = code ? await this.channels.findActiveByCode(code) : null;
    if (!secret || !channel || !req.rawBody) throw problem('invalid-signature', '알 수 없는 채널이다');

    const result = verify(secret, req.headers[TIMESTAMP_HEADER], req.headers[SIGNATURE_HEADER], req.rawBody);
    if (result === 'stale') throw problem('stale-request');
    if (result !== 'ok') throw problem('invalid-signature');

    req.channel = channel;
    return true;
  }
}
