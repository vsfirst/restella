// REQ-19 동시 예약 시뮬레이션, NFR-02 응답 시간
import { login, operatorApi, resetDb, startApp, type TestContext } from './support/test-app.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await startApp();
  await resetDb(ctx);
  token = await login(ctx);
});
afterAll(async () => ctx?.close());
beforeEach(async () => resetDb(ctx));

describe('REQ-19 동시 예약 시뮬레이션', () => {
  it('AC-19-1~3: 남은 1실에 50건을 보내면 확정 1건, 나머지는 거절·충돌·중복이고 초과 판매는 0건이다', async () => {
    const res = await operatorApi(ctx, token, 'POST', '/api/v1/simulations', {
      roomTypeId: 3,
      checkIn: '2026-10-10',
      checkOut: '2026-10-11',
      prepareRemaining: 1,
      requestCount: 50,
      notifyRatio: 40,
      duplicateRatio: 10,
    });
    expect(res.status).toBe(201);
    const r = res.body.result;
    expect(r.confirmed).toBe(1);
    expect(r.duplicates).toBe(5);
    expect(r.errors).toBe(0);
    expect(r.confirmed + r.rejected + r.conflicts + r.duplicates).toBe(50);
    expect(r.conflicts).toBeGreaterThan(0); // 통보형은 거절할 수 없어 충돌로 드러난다
    expect(r.invariantOk).toBe(true);
    expect(r.overbookedNights).toBe(0);
    // NFR-02 AC-N02-2: 50건 시뮬레이션이 10초 안에 끝난다
    expect(r.durationMs).toBeLessThan(10_000);

    const runs = await operatorApi(ctx, token, 'GET', '/api/v1/simulations');
    expect(runs.body[0].result.confirmed).toBe(1);
  });

  it('준비 단계의 재고 조정은 시뮬레이터 출처로 이벤트 로그에 남는다', async () => {
    const res = await operatorApi(ctx, token, 'POST', '/api/v1/simulations', {
      roomTypeId: 1,
      checkIn: '2026-10-12',
      checkOut: '2026-10-14',
      prepareRemaining: 2,
      requestCount: 10,
      notifyRatio: 0,
      duplicateRatio: 0,
    });
    expect(res.body.result).toMatchObject({ confirmed: 2, rejected: 8, conflicts: 0, invariantOk: true });
    const [ev] = await ctx.ds.query(`SELECT detail FROM event_log WHERE type = 'INVENTORY_ADJUSTED' LIMIT 1`);
    const detail = typeof ev.detail === 'string' ? JSON.parse(ev.detail) : ev.detail;
    expect(detail.source).toBe(`SIMULATOR:${res.body.id}`);
  });
});
