// 운영자 콘솔 API: REQ-02, 03, 13, 14, 15, 16, 17
import { booking, login, nights, operatorApi, reserve, resetDb, setRemaining, startApp, type TestContext } from './support/test-app.js';

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

async function makeConflict(no: string, channel = 'OTA_A') {
  await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
  await reserve(ctx, channel, booking(no));
  const { body } = await api('GET', '/api/v1/conflicts');
  return body.items.find((c: { channelReservationNo: string }) => c.channelReservationNo === no) as { id: number; reservationId: number };
}

describe('REQ-02 재고 달력', () => {
  it('AC-02-1: 객실타입 × 날짜마다 총 재고, 판매 수, 남은 재고를 준다', async () => {
    await reserve(ctx, 'DIRECT', booking('D-1'));
    const res = await api('GET', '/api/v1/inventory?from=2026-10-10&to=2026-10-12');
    expect(res.status).toBe(200);
    expect(res.body.map((r: { code: string }) => r.code)).toEqual(['DLX-DBL', 'STD-TWN', 'FAM-STE']);
    const fam = res.body[2];
    expect(fam.days[0]).toEqual({ stayDate: '2026-10-10', total: 4, sold: 1, available: 3 });
    expect(fam.days).toHaveLength(3);
  });

  it('AC-02-1: 기간은 최대 31일이다', async () => {
    expect((await api('GET', '/api/v1/inventory?from=2026-10-01&to=2026-10-31')).status).toBe(200);
    expect((await api('GET', '/api/v1/inventory?from=2026-10-01&to=2026-11-01')).status).toBe(400);
  });

  it('AC-02-2: 매진은 남은 재고 0으로 구분된다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    const res = await api('GET', '/api/v1/inventory?from=2026-10-10&to=2026-10-10');
    expect(res.body[2].days[0].available).toBe(0);
  });
});

describe('REQ-03 총 재고 조정', () => {
  it('AC-03-1: 총 재고를 바꿀 수 있다', async () => {
    const res = await api('PATCH', '/api/v1/inventory/1/2026-10-17', { totalRooms: 7 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalRooms: 7, available: 7 });
  });

  it('AC-03-2: 판매 수보다 작게 줄이면 409', async () => {
    await reserve(ctx, 'DIRECT', booking('D-1'));
    await reserve(ctx, 'DIRECT', booking('D-2'));
    const res = await api('PATCH', '/api/v1/inventory/3/2026-10-10', { totalRooms: 1 });
    expect(res.status).toBe(409);
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.total_rooms).toBe(4);
  });
});

describe('REQ-13, 14, 15 충돌 처리', () => {
  it('AC-13-1: 충돌 처리함에 채널, 예약번호, 객실타입, 숙박일, 접수 시각이 보인다', async () => {
    await makeConflict('A-1');
    const res = await api('GET', '/api/v1/conflicts');
    expect(res.body.openCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      status: 'OPEN',
      channelCode: 'OTA_A',
      channelReservationNo: 'A-1',
      roomTypeCode: 'FAM-STE',
      checkIn: '2026-10-10',
      checkOut: '2026-10-11',
    });
    expect(res.body.items[0].detectedAt).toBeTruthy();
  });

  it('AC-14-1: 취소로 처리하면 예약이 취소되고 채널에 전달된다', async () => {
    const c = await makeConflict('A-1');
    const res = await api('POST', `/api/v1/conflicts/${c.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', channelNotified: true });
    const s = (await (await fetch(`${ctx.baseUrl}/internal/simulator/channels`)).json()) as any;
    expect(s.cancellations.OTA_A.map((x: any) => x.channelReservationNo)).toContain('A-1');
  });

  it('AC-14-2: 해결됨 처리에는 메모가 필수다', async () => {
    const c = await makeConflict('A-1');
    expect((await api('POST', `/api/v1/conflicts/${c.id}/resolve`, { note: '   ' })).status).toBe(400);
    const ok = await api('POST', `/api/v1/conflicts/${c.id}/resolve`, { note: '인근 제휴 숙소로 안내' });
    expect(ok.status).toBe(200);
    const [row] = await ctx.ds.query('SELECT status, resolution_note FROM conflict WHERE id = ?', [c.id]);
    expect(row).toMatchObject({ status: 'RESOLVED', resolution_note: '인근 제휴 숙소로 안내' });
  });

  it('AC-14-3: 처리된 충돌은 미처리 목록에서 빠지고 이벤트 로그에 남는다', async () => {
    const c = await makeConflict('A-1');
    await api('POST', `/api/v1/conflicts/${c.id}/resolve`, { note: '처리함' });
    expect((await api('GET', '/api/v1/conflicts')).body.openCount).toBe(0);
    const ev = await api('GET', '/api/v1/events?type=CONFLICT_RESOLVED');
    expect(ev.body.items).toHaveLength(1);
    expect((await api('POST', `/api/v1/conflicts/${c.id}/resolve`, { note: '또' })).status).toBe(409);
  });

  it('AC-15-1: 재고가 있는 다른 객실타입으로 옮기면 그 재고가 차감되고 예약은 확정된다', async () => {
    const c = await makeConflict('A-1');
    const res = await api('POST', `/api/v1/conflicts/${c.id}/move`, { roomTypeId: 2 });
    expect(res.status).toBe(200);
    const [std] = await nights(ctx, 'STD-TWN', '2026-10-10', '2026-10-10');
    expect(std.sold_rooms).toBe(1);
    const detail = await api('GET', `/api/v1/reservations/${c.reservationId}`);
    expect(detail.body).toMatchObject({ status: 'CONFIRMED', roomTypeCode: 'STD-TWN' });
  });
});

describe('REQ-16 예약 목록', () => {
  it('AC-16-1: 채널, 상태, 숙박 기간으로 거른다', async () => {
    await reserve(ctx, 'DIRECT', booking('D-1'));
    await reserve(ctx, 'OTA_A', booking('A-1', { checkIn: '2026-10-20', checkOut: '2026-10-21' }));
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    await reserve(ctx, 'OTA_B', booking('B-1'));

    const all = await api('GET', '/api/v1/reservations');
    expect(all.body.items).toHaveLength(3);
    const conflicts = await api('GET', '/api/v1/reservations?status=CONFLICT');
    expect(conflicts.body.items.map((r: any) => r.channelReservationNo)).toEqual(['B-1']);
    const byPeriod = await api('GET', '/api/v1/reservations?from=2026-10-20&to=2026-10-25');
    expect(byPeriod.body.items.map((r: any) => r.channelReservationNo)).toEqual(['A-1']);
    const byChannel = await api('GET', `/api/v1/reservations?channelId=${String(all.body.items.find((r: any) => r.channelCode === 'DIRECT').channelId)}`);
    expect(byChannel.body.items.map((r: any) => r.channelReservationNo)).toEqual(['D-1']);
  });

  it('예약 상세에는 숙박일과 이력이 있다', async () => {
    const { body } = await reserve(ctx, 'DIRECT', booking('D-1', { checkOut: '2026-10-12' }));
    await reserve(ctx, 'DIRECT', booking('D-1', { checkOut: '2026-10-12' }));
    const res = await api('GET', `/api/v1/reservations/${String(body.reservationId)}`);
    expect(res.body.nights).toEqual(['2026-10-10', '2026-10-11']);
    expect(res.body.history.map((h: any) => h.type)).toEqual(['RESERVATION_CONFIRMED', 'RESERVATION_DUPLICATE']);
  });
});

describe('REQ-17 이벤트 로그', () => {
  it('AC-17-1: 확정, 중복, 거절, 충돌, 재고 조정이 시간순으로 기록된다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 1);
    await reserve(ctx, 'DIRECT', booking('D-1'));
    await reserve(ctx, 'DIRECT', booking('D-1'));
    await reserve(ctx, 'APPROVAL', booking('P-1'));
    await reserve(ctx, 'OTA_A', booking('A-1'));
    await api('PATCH', '/api/v1/inventory/1/2026-10-17', { totalRooms: 7 });
    // 동기화 발송기의 SYNC_* 이벤트는 비동기로 섞이므로 업무 이벤트만 본다
    const business = 'RESERVATION_CONFIRMED,RESERVATION_DUPLICATE,RESERVATION_REJECTED,RESERVATION_CONFLICT,INVENTORY_ADJUSTED';
    const res = await api('GET', `/api/v1/events?limit=10&type=${business}`);
    expect(res.body.items.map((e: any) => e.type).reverse()).toEqual([
      'RESERVATION_CONFIRMED',
      'RESERVATION_DUPLICATE',
      'RESERVATION_REJECTED',
      'RESERVATION_CONFLICT',
      'INVENTORY_ADJUSTED',
    ]);
  });
});
