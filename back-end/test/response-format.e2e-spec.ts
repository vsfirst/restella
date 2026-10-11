// 공통 응답 형식: 오류는 RFC 9457 problem+json, 모든 응답에 X-Request-Id (docs/2-design/api.md "응답 형식")
import { booking, login, operatorApi, reserve, resetDb, startApp, type TestContext } from './support/test-app.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await startApp();
  await resetDb(ctx);
  token = await login(ctx);
});
afterAll(async () => ctx?.close());
beforeEach(async () => resetDb(ctx));

const api = (method: string, path: string, body?: unknown) => operatorApi(ctx, token, method, path, body);

describe('응답 형식', () => {
  it('모든 응답에 X-Request-Id가 있고, 앞단이 보낸 형식에 맞는 값은 이어 쓴다', async () => {
    const plain = await fetch(`${ctx.baseUrl}/health/live`);
    expect(plain.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

    const passed = await fetch(`${ctx.baseUrl}/health/live`, { headers: { 'x-request-id': 'bff-req-12345678' } });
    expect(passed.headers.get('x-request-id')).toBe('bff-req-12345678');

    const invalid = await fetch(`${ctx.baseUrl}/health/live`, { headers: { 'x-request-id': 'bad id!' } });
    expect(invalid.headers.get('x-request-id')).not.toBe('bad id!');
  });

  it('입력 오류는 어느 필드가 왜 틀렸는지 errors로 알려 주고, requestId가 헤더와 같다', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/inventory/3/2026-10-10`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ totalRooms: 'many', unknown: 1 }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { type: string; errors: { field: string }[]; requestId: string };
    expect(body.type).toBe('urn:restella:problem:validation');
    expect(body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['totalRooms', 'unknown']));
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('업무 규칙 위반은 정해진 유형으로 알려 준다', async () => {
    await reserve(ctx, 'DIRECT', booking('D-1'));
    const below = await api('PATCH', '/api/v1/inventory/3/2026-10-10', { totalRooms: 0 });
    expect(below.status).toBe(409);
    expect(below.body).toMatchObject({ type: 'urn:restella:problem:total-below-sold', title: '판매 수보다 작게 줄일 수 없다' });

    const missing = await api('GET', '/api/v1/reservations/999999');
    expect(missing.status).toBe(404);
    expect(missing.body.type).toBe('urn:restella:problem:not-found');
  });

  it('로그인 실패와 토큰 없음은 다른 유형이다', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ loginId: 'demo-operator', password: 'wrong-password' }),
    });
    expect(((await res.json()) as { type: string }).type).toBe('urn:restella:problem:invalid-credentials');
    const noToken = await fetch(`${ctx.baseUrl}/api/v1/room-types`);
    expect(((await noToken.json()) as { type: string }).type).toBe('urn:restella:problem:unauthorized');
  });
});
