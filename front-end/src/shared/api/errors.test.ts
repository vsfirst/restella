import { describe, expect, it } from 'vitest';
import { errorMessage, toApiError } from './errors';

const problem = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json', ...headers } });

describe('toApiError', () => {
  it('유형, 요청 ID, 필드 오류를 꺼낸다', async () => {
    const e = await toApiError(
      problem(400, {
        type: 'urn:restella:problem:validation',
        title: '입력값이 올바르지 않다',
        requestId: 'req-12345678',
        errors: [{ field: 'totalRooms', message: 'totalRooms must be an integer number' }],
      }),
    );
    expect(e.type).toBe('validation');
    expect(e.requestId).toBe('req-12345678');
    expect(e.fieldError('totalRooms')).toContain('integer');
  });

  it('서버 오류 문구에는 요청 ID를 붙인다', async () => {
    const e = await toApiError(problem(500, { type: 'urn:restella:problem:internal', title: '서버 오류' }, { 'x-request-id': 'req-abcdef12' }));
    expect(errorMessage(e)).toBe('서버 오류 (요청 ID: req-abcdef12)');
  });
});
