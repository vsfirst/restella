import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Channel } from './channel.entity.js';

/** ChannelSignatureGuard가 검증한 채널 */
export const VerifiedChannel = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Channel => ctx.switchToHttp().getRequest<{ channel: Channel }>().channel,
);
