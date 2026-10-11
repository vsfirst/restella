import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * 요청마다 ID를 붙여 응답 헤더(X-Request-Id)와 오류 본문(requestId)에 싣는다.
 * 앞단(BFF)이 보낸 값이 형식에 맞으면 이어 쓰고, 아니면 새로 만든다. 로그에서 같은 요청을 찾는 데 쓴다
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  res.setHeader(REQUEST_ID_HEADER, incoming && VALID.test(incoming) ? incoming : randomUUID());
  next();
}
