// REQ-18 운영자 로그인, REQ-13 실시간 알림(SSE), NFR-05 관측
import { booking, login, OPERATOR_PASSWORD, reserve, resetDb, setRemaining, startApp, type TestContext } from './support/test-app.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
  await resetDb(ctx);
});
afterAll(async () => ctx?.close());

const loginWith = (password: string) =>
  fetch(`${ctx.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginId: 'demo-operator', password }),
  });

describe('REQ-18 운영자 로그인', () => {
  it('AC-18-1: 토큰 없이는 운영자 API에 접근할 수 없다', async () => {
    for (const path of ['/api/v1/inventory?from=2026-10-10&to=2026-10-10', '/api/v1/reservations', '/api/v1/conflicts', '/api/v1/events']) {
      expect((await fetch(`${ctx.baseUrl}${path}`)).status).toBe(401);
    }
    const forged = await fetch(`${ctx.baseUrl}/api/v1/reservations`, { headers: { authorization: 'Bearer forged.token.value' } });
    expect(forged.status).toBe(401);
  });

  it('AC-18-2: 토큰은 8시간 뒤 만료된다', async () => {
    const res = await loginWith(OPERATOR_PASSWORD);
    const body = (await res.json()) as { accessToken: string; expiresAt: string };
    const ttl = Date.parse(body.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(8 * 3600_000 - 60_000);
    expect(ttl).toBeLessThanOrEqual(8 * 3600_000);
  });

  it('틀린 비밀번호는 401이고 이유를 구분하지 않는다', async () => {
    const res = await loginWith('wrong-password');
    expect(res.status).toBe(401);
  });
});

describe('REQ-13 실시간 알림 (SSE)', () => {
  it('AC-13-2: 충돌이 생기면 5초 안에 스트림으로 알림이 온다', async () => {
    const token = await login(ctx);
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    const controller = new AbortController();
    const res = await fetch(`${ctx.baseUrl}/api/v1/events/stream`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const started = Date.now();
    void reserve(ctx, 'OTA_A', booking('A-1'));
    let text = '';
    while (!text.includes('event: conflict.created') && Date.now() - started < 5_000) {
      const { value, done } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    controller.abort();
    expect(text).toContain('event: conflict.created');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe('NFR-05 관측', () => {
  it('AC-N05-1: /metrics에 예약 결과, 동기화 지연, API 응답 시간 지표가 있다', async () => {
    await reserve(ctx, 'DIRECT', booking('D-9'));
    const text = await (await fetch(`${ctx.baseUrl}/metrics`)).text();
    expect(text).toContain('restella_reservations_total');
    expect(text).toContain('restella_sync_latency_seconds');
    expect(text).toContain('restella_http_request_duration_seconds');
  });

  it('상태 확인: live와 ready(DB 연결)', async () => {
    expect((await fetch(`${ctx.baseUrl}/health/live`)).status).toBe(200);
    const ready = await fetch(`${ctx.baseUrl}/health/ready`);
    expect(ready.status).toBe(200);
  });

  it('API 문서(Swagger)가 열린다', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/docs-json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain('/api/v1/channel/reservations');
  });
});

describe('로그인 시도 제한 (docs/2-design/api.md)', () => {
  // 같은 IP의 로그인 시도 횟수를 소모하므로 이 파일의 마지막에 둔다
  it('같은 IP에서 1분에 5회를 넘으면 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await loginWith('wrong-password')).status);
    expect(statuses.at(-1)).toBe(429);
  });
});
