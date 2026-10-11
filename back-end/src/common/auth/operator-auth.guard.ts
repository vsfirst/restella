import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC } from './public.decorator.js';
import { problem } from '../http/problem.js';

export interface OperatorPrincipal {
  id: number;
  name: string;
}

interface OperatorRequest {
  headers: Record<string, string | undefined>;
  operator?: OperatorPrincipal;
}

// 운영자 API 전체에 적용되는 전역 가드 (REQ-18). Authorization: Bearer <JWT>
@Injectable()
export class OperatorAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<OperatorRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw problem('unauthorized');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; name: string }>(token);
      req.operator = { id: Number(payload.sub), name: payload.name };
      return true;
    } catch {
      throw problem('unauthorized', '토큰이 없거나 만료되었다');
    }
  }
}
