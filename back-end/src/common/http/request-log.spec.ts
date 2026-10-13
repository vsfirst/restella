import { formatRequestLog, levelOf, shouldLog } from './request-log.js';

describe('요청 로그', () => {
  it('헬스체크와 지표 수집 경로는 남기지 않는다', () => {
    expect(shouldLog('/health/live')).toBe(false);
    expect(shouldLog('/health/ready')).toBe(false);
    expect(shouldLog('/metrics')).toBe(false);
    expect(shouldLog('/api/v1/reservations')).toBe(true);
    expect(shouldLog('/api/v1/metrics-like')).toBe(true);
  });

  it('4xx는 WARN, 5xx는 ERROR로 남긴다', () => {
    expect(levelOf(200)).toBe('log');
    expect(levelOf(304)).toBe('log');
    expect(levelOf(401)).toBe('warn');
    expect(levelOf(409)).toBe('warn');
    expect(levelOf(500)).toBe('error');
    expect(levelOf(503)).toBe('error');
  });

  it('메서드, 경로, 상태, 처리 시간, 요청 ID를 한 줄로', () => {
    const base = { method: 'POST', path: '/api/v1/reservations/7/cancel', status: 200, durationMs: 12.345, requestId: 'bff-req-12345678' };
    expect(formatRequestLog({ ...base, closedEarly: false })).toBe(
      'POST /api/v1/reservations/7/cancel 200 12.3ms requestId=bff-req-12345678',
    );
    expect(formatRequestLog({ ...base, closedEarly: true })).toBe(
      'POST /api/v1/reservations/7/cancel 200 closed 12.3ms requestId=bff-req-12345678',
    );
  });
});
