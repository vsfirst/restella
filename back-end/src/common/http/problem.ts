import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { type FieldError, PROBLEM_TYPES, type ProblemType } from './problems.js';
import { REQUEST_ID_HEADER } from './request-id.js';

// 오류 응답은 RFC 9457 application/problem+json으로 통일한다 (docs/2-design/api.md "공통 규칙")

/** 목록(problems.ts)에 있는 유형으로만 오류를 만든다. detail은 이번 요청에 대한 구체적인 설명이다 */
export class ProblemException extends HttpException {
  constructor(
    readonly problemType: ProblemType,
    detail?: string,
    readonly errors?: FieldError[],
  ) {
    super({ title: PROBLEM_TYPES[problemType].title, detail }, PROBLEM_TYPES[problemType].status);
  }
}

export const problem = (type: ProblemType, detail?: string, errors?: FieldError[]) => new ProblemException(type, detail, errors);

/** Nest·라이브러리가 던진 예외(없는 경로, 시도 제한 등)의 유형 */
const DEFAULT_TYPES: Partial<Record<number, ProblemType>> = {
  400: 'validation',
  401: 'unauthorized',
  404: 'not-found',
  429: 'too-many-requests',
  502: 'upstream-failed',
  503: 'service-unavailable',
};

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<{ url: string }>();
    const requestId = res.getHeader(REQUEST_ID_HEADER) as string | undefined;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const type = exception instanceof ProblemException ? exception.problemType : (DEFAULT_TYPES[status] ?? 'internal');
      const problem: Record<string, unknown> = { type: `urn:restella:problem:${type}`, status, instance: req.url, requestId };
      if (typeof body === 'string') {
        problem.title = body;
      } else {
        const b = body as { title?: string; message?: string | string[]; detail?: string; error?: string };
        problem.title = b.title ?? b.error ?? exception.message;
        const detail = b.detail ?? (typeof b.message === 'string' && b.message !== problem.title ? b.message : undefined);
        if (detail) problem.detail = detail;
      }
      if (exception instanceof ProblemException && exception.errors?.length) problem.errors = exception.errors;
      res.status(status).type('application/problem+json').json(problem);
      return;
    }

    // 예상하지 못한 오류: 내용은 숨기고 requestId로 로그를 찾게 한다
    this.logger.error({ requestId, url: req.url, error: exception instanceof Error ? exception.stack : String(exception) });
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type('application/problem+json')
      .json({ type: 'urn:restella:problem:internal', title: PROBLEM_TYPES.internal.title, status: 500, instance: req.url, requestId });
  }
}
