import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verify } from '../../common/crypto/signature.js';
import type { Env } from '../../config/env.validation.js';
import { problem } from '../../common/http/problem.js';

// 가짜 채널 쪽에서 "정말 Restella가 보낸 요청인지" 서명을 확인한다. 실제 채널도 같은 검사를 한다.
@Injectable()
export class OutboundSignatureGuard implements CanActivate {
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('OUTBOUND_SIGNING_SECRET', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; rawBody?: Buffer }>();
    if (!req.rawBody || verify(this.secret, req.headers[TIMESTAMP_HEADER], req.headers[SIGNATURE_HEADER], req.rawBody) !== 'ok') {
      throw problem('invalid-signature', 'Restella 서명이 올바르지 않다');
    }
    return true;
  }
}
