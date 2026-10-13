import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.js';

// 주기적으로 불리는 경로는 남기지 않는다 (kubelet 헬스체크, Prometheus 수집)
const SKIP = [/^\/health\//, /^\/metrics$/];

const logger = new Logger('HTTP');

export type RequestLogLevel = 'log' | 'warn' | 'error';

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  /** 응답을 끝까지 보내기 전에 연결이 닫혔는지 (SSE 구독 종료, 클라이언트 중단) */
  closedEarly: boolean;
  durationMs: number;
  requestId: string;
}

export function shouldLog(path: string): boolean {
  return !SKIP.some((re) => re.test(path));
}

export function levelOf(status: number): RequestLogLevel {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'log';
}

export function formatRequestLog(e: RequestLogEntry): string {
  const status = e.closedEarly ? `${e.status} closed` : String(e.status);
  return `${e.method} ${e.path} ${status} ${e.durationMs.toFixed(1)}ms requestId=${e.requestId}`;
}

/**
 * 요청마다 한 줄: 메서드, 경로, 상태, 처리 시간, 요청 ID. 4xx는 WARN, 5xx는 ERROR.
 * 개인정보가 섞이지 않게 쿼리 문자열, 본문, 접속자 IP는 남기지 않는다.
 * requestId 미들웨어 뒤에 둔다
 */
export function requestLog(req: Request, res: Response, next: NextFunction): void {
  if (!shouldLog(req.path)) return next();
  const start = process.hrtime.bigint();
  res.once('close', () => {
    const entry: RequestLogEntry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      closedEarly: !res.writableFinished,
      durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      requestId: String(res.getHeader(REQUEST_ID_HEADER) ?? '-'),
    };
    logger[levelOf(entry.status)](formatRequestLog(entry));
  });
  next();
}
