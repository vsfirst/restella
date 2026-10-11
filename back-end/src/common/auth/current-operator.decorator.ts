import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { OperatorPrincipal } from './operator-auth.guard.js';

export const CurrentOperator = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OperatorPrincipal => ctx.switchToHttp().getRequest<{ operator: OperatorPrincipal }>().operator,
);
