// REQ-10 예약 취소
import { booking, channelPost, login, nights, operatorApi, reserve, resetDb, setRemaining, startApp, type TestContext, waitFor } from './support/test-app.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await startApp();
  await resetDb(ctx);
  token = await login(ctx);
});
afterAll(async () => ctx?.close());
beforeEach(async () => resetDb(ctx));

const cancelByChannel = (code: string, no: string) => channelPost(ctx, code, `/api/v1/channel/reservations/${no}/cancel`, {});

describe('REQ-10 예약 취소', () => {
  it('AC-10-1: 확정 예약을 채널이 취소하면 모든 숙박일 판매 수가 정확히 1씩 줄어든다', async () => {
    await reserve(ctx, 'OTA_A', booking('A-1', { checkIn: '2026-10-10', checkOut: '2026-10-13' }));
    const res = await cancelByChannel('OTA_A', 'A-1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    const rows = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-12');
    expect(rows.map((r) => r.sold_rooms)).toEqual([0, 0, 0]);
  });

  it('AC-10-2: 이미 취소된 예약을 다시 취소해도 재고는 변하지 않는다', async () => {
    await reserve(ctx, 'OTA_A', booking('A-1'));
    await reserve(ctx, 'OTA_B', booking('B-1'));
    await cancelByChannel('OTA_A', 'A-1');
    const again = await cancelByChannel('OTA_A', 'A-1');
    expect(again.status).toBe(200);
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(1); // B-1만 남는다
  });

  it('AC-10-3: 충돌 상태 예약을 취소하면 재고는 변하지 않고 충돌은 취소로 닫힌다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    await reserve(ctx, 'OTA_B', booking('B-1'));
    const [before] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    await cancelByChannel('OTA_B', 'B-1');
    const [after] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(after.sold_rooms).toBe(before.sold_rooms);
    const [c] = await ctx.ds.query('SELECT status FROM conflict');
    expect(c.status).toBe('CANCELLED');
  });

  it('AC-10-4: 운영자 취소도 재고를 되돌리고, 채널 동기화와 채널 취소 통지가 일어난다', async () => {
    const { body } = await reserve(ctx, 'DIRECT', booking('D-1'));
    const res = await operatorApi(ctx, token, 'POST', `/api/v1/reservations/${String(body.reservationId)}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', inventoryRestored: true, channelNotified: true });
    const snapshot = await waitFor(async () => {
      const s = (await (await fetch(`${ctx.baseUrl}/internal/simulator/channels`)).json()) as any;
      const fam = s.availability.OTA_A?.find((a: any) => a.roomTypeCode === 'FAM-STE' && a.stayDate === '2026-10-10');
      return fam?.available === 4 ? s : undefined; // 취소 후 남은 재고 4 (총 4실)
    });
    expect(snapshot.cancellations.DIRECT.map((c: any) => c.channelReservationNo)).toContain('D-1');
  });

  it('거절된 예약은 취소할 수 없다 (409)', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    await reserve(ctx, 'DIRECT', booking('D-1'));
    const res = await cancelByChannel('DIRECT', 'D-1');
    expect(res.status).toBe(409);
  });

  it('해당 채널에 없는 예약번호는 404', async () => {
    const res = await cancelByChannel('OTA_A', 'NOPE');
    expect(res.status).toBe(404);
  });
});
