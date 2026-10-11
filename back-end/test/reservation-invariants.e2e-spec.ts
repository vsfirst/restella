// 예약 정합성 불변식 (REQ-01, 04, 05, 06, 07, 08 / NFR-01)
// 테스트 이름의 AC-xx-x는 docs/1-planning/requirements.md의 완료 조건 ID다.
import { booking, nights, reserve, resetDb, setRemaining, startApp, type TestContext } from './support/test-app.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startApp();
});

afterAll(async () => {
  await ctx?.close();
});

beforeEach(async () => {
  await resetDb(ctx);
});

describe('REQ-01 숙박일 단위 재고', () => {
  it('AC-01-1: 10-10 → 10-12 예약은 10-10과 10-11만 차감하고 10-12는 그대로다', async () => {
    const res = await reserve(ctx, 'DIRECT', booking('D-1', { roomTypeCode: 'DLX-DBL', checkIn: '2026-10-10', checkOut: '2026-10-12' }));
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('CONFIRMED');
    const rows = await nights(ctx, 'DLX-DBL', '2026-10-09', '2026-10-12');
    expect(rows.map((r) => [r.stay_date, r.sold_rooms])).toEqual([
      ['2026-10-09', 0],
      ['2026-10-10', 1],
      ['2026-10-11', 1],
      ['2026-10-12', 0],
    ]);
  });

  it('AC-01-2: 체크아웃이 체크인과 같거나 빠르면 400이고 재고는 그대로다', async () => {
    for (const checkOut of ['2026-10-10', '2026-10-09']) {
      const res = await reserve(ctx, 'DIRECT', booking(`D-${checkOut}`, { checkIn: '2026-10-10', checkOut }));
      expect(res.status).toBe(400);
    }
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(0);
  });

  it('AC-01-3: 재고가 등록되지 않은 날짜가 섞이면 매진과 같이 처리한다', async () => {
    // 시드는 2026-10-01부터 60일치 → 2026-11-30부터 재고 없음
    const res = await reserve(ctx, 'DIRECT', booking('D-1', { checkIn: '2026-11-28', checkOut: '2026-12-02' }));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ result: 'REJECTED', reason: 'SOLD_OUT' });
    const rows = await nights(ctx, 'FAM-STE', '2026-11-28', '2026-11-29');
    expect(rows.every((r) => r.sold_rooms === 0)).toBe(true);
  });
});

describe('REQ-04 예약 확정 (전부 아니면 전무)', () => {
  it('AC-04-1: 모든 숙박일에 재고가 있으면 확정하고 각 숙박일을 1씩 차감한다', async () => {
    const res = await reserve(ctx, 'OTA_A', booking('A-1', { checkIn: '2026-10-10', checkOut: '2026-10-13' }));
    expect(res.body.result).toBe('CONFIRMED');
    const rows = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-12');
    expect(rows.map((r) => r.sold_rooms)).toEqual([1, 1, 1]);
  });

  it('AC-04-2: 숙박일 중 하나라도 매진이면 어느 날짜도 차감하지 않는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-11', 0); // 가운데 날짜만 매진
    const res = await reserve(ctx, 'DIRECT', booking('D-1', { checkIn: '2026-10-10', checkOut: '2026-10-13' }));
    expect(res.status).toBe(409);
    const rows = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-12');
    expect(rows.map((r) => r.sold_rooms)).toEqual([0, 0, 0]);
  });
});

describe('REQ-05 동시 요청에도 초과 판매 없음', () => {
  it('AC-05-1: 남은 1실에 확인형 요청 50건이 동시에 오면 정확히 1건만 확정된다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 1);
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => reserve(ctx, i % 2 ? 'DIRECT' : 'APPROVAL', booking(`C-${i}`))),
    );
    expect(results.filter((r) => r.body.result === 'CONFIRMED')).toHaveLength(1);
    expect(results.filter((r) => r.status === 409 && r.body.result === 'REJECTED')).toHaveLength(49);
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(row.total_rooms);
  });

  it('AC-05-2: 섞인 동시 요청(연박·채널 유형)에서도 모든 숙박일의 판매 수 ≤ 총 재고', async () => {
    const ranges = [
      ['2026-10-10', '2026-10-12'],
      ['2026-10-11', '2026-10-14'],
      ['2026-10-12', '2026-10-13'],
      ['2026-10-10', '2026-10-15'],
      ['2026-10-13', '2026-10-15'],
    ];
    const channels = ['DIRECT', 'APPROVAL', 'OTA_A', 'OTA_B', 'OTA_C'];
    const results = await Promise.all(
      Array.from({ length: 80 }, (_, i) => {
        const [checkIn, checkOut] = ranges[i % ranges.length];
        return reserve(ctx, channels[i % channels.length], booking(`M-${i}`, { checkIn, checkOut }));
      }),
    );
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
    const rows = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-14');
    for (const r of rows) expect(r.sold_rooms).toBeLessThanOrEqual(r.total_rooms);
    // 총 재고 4실이라 대부분 매진된다
    expect(rows.some((r) => r.sold_rooms === r.total_rooms)).toBe(true);
  });

  it('AC-05-3: 숙박일이 겹치는 연박 예약이 동시에 와도 모두 확정 또는 거절로 끝난다 (교착·시간 초과 없음)', async () => {
    // 서로 다른 순서로 겹치는 범위: 잠금 순서가 고정되지 않으면 교착이 나는 조합
    const ranges = [
      ['2026-10-20', '2026-10-25'],
      ['2026-10-22', '2026-10-27'],
      ['2026-10-18', '2026-10-23'],
      ['2026-10-24', '2026-10-26'],
    ];
    const results = await Promise.all(
      Array.from({ length: 60 }, (_, i) => {
        const [checkIn, checkOut] = ranges[i % ranges.length];
        return reserve(ctx, 'DIRECT', booking(`O-${i}`, { roomTypeCode: 'STD-TWN', checkIn, checkOut }));
      }),
    );
    expect(results.map((r) => r.status).filter((s) => s !== 200 && s !== 409)).toEqual([]);
    const rows = await nights(ctx, 'STD-TWN', '2026-10-18', '2026-10-26');
    for (const r of rows) expect(r.sold_rooms).toBeLessThanOrEqual(r.total_rooms);
  });
});

describe('REQ-06 확인형 채널: 매진이면 거절', () => {
  it('AC-06-1: 409 REJECTED를 받고 예약은 확정되지 않는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    const res = await reserve(ctx, 'APPROVAL', booking('P-1'));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ result: 'REJECTED', reason: 'SOLD_OUT' });
    const [r] = await ctx.ds.query(`SELECT status FROM reservation WHERE channel_reservation_no = 'P-1'`);
    expect(r.status).toBe('REJECTED');
  });

  it('AC-06-2: 거절도 이벤트 로그에 남는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    await reserve(ctx, 'APPROVAL', booking('P-1'));
    const [e] = await ctx.ds.query(`SELECT type, actor FROM event_log WHERE type = 'RESERVATION_REJECTED'`);
    expect(e).toMatchObject({ type: 'RESERVATION_REJECTED', actor: 'CHANNEL:APPROVAL' });
  });
});

describe('REQ-07 통보형 채널: 매진이면 오버부킹 충돌', () => {
  it('AC-07-1, 07-2: 수신은 200 CONFLICT, 충돌로 저장되고 판매 수는 늘지 않는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    const res = await reserve(ctx, 'OTA_B', booking('B-1'));
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('CONFLICT');
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(row.total_rooms);
    const [c] = await ctx.ds.query(
      `SELECT cf.status FROM conflict cf JOIN reservation r ON r.id = cf.reservation_id WHERE r.channel_reservation_no = 'B-1'`,
    );
    expect(c.status).toBe('OPEN');
  });
});

describe('REQ-08 같은 예약이 다시 와도 한 번만 처리', () => {
  it('AC-08-1, 08-2: 같은 예약을 3번 보내도 1건이고, 다시 보낸 요청은 처음과 같은 결과를 받는다', async () => {
    const first = await reserve(ctx, 'OTA_A', booking('A-1'));
    const again = [await reserve(ctx, 'OTA_A', booking('A-1')), await reserve(ctx, 'OTA_A', booking('A-1'))];
    for (const r of again) {
      expect(r.status).toBe(first.status);
      expect(r.body).toEqual(first.body);
      expect(r.headers.get('idempotent-replayed')).toBe('true');
    }
    const [{ n }] = await ctx.ds.query(`SELECT COUNT(*) AS n FROM reservation WHERE channel_reservation_no = 'A-1'`);
    expect(Number(n)).toBe(1);
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(1);
  });

  it('AC-08-2: 거절된 예약을 다시 보내면, 그 사이 재고가 생겼어도 처음 결과(거절)를 받는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 0);
    const first = await reserve(ctx, 'DIRECT', booking('D-1'));
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 2);
    const again = await reserve(ctx, 'DIRECT', booking('D-1'));
    expect(again.status).toBe(409);
    expect(again.body).toEqual(first.body);
  });

  it('AC-08-3: 같은 예약이 동시에 20건 와도 예약은 1건이고 재고는 한 번만 차감된다', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserve(ctx, 'OTA_C', booking('C-1'))));
    expect(results.filter((r) => r.headers.get('idempotent-replayed') !== 'true')).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.reservationId)).size).toBe(1);
    const [row] = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-10');
    expect(row.sold_rooms).toBe(1);
  });

  it('같은 예약번호로 다른 내용이 오면 422이고 기존 예약은 그대로다', async () => {
    await reserve(ctx, 'OTA_A', booking('A-1'));
    const res = await reserve(ctx, 'OTA_A', booking('A-1', { checkOut: '2026-10-12' }));
    expect(res.status).toBe(422);
    const rows = await nights(ctx, 'FAM-STE', '2026-10-10', '2026-10-11');
    expect(rows.map((r) => r.sold_rooms)).toEqual([1, 0]);
  });
});

describe('NFR-01 DB 제약', () => {
  it('AC-N01-1: 로직을 거치지 않고 판매 수를 총 재고보다 크게 저장하려 해도 DB가 막는다', async () => {
    await expect(
      ctx.ds.query(
        `UPDATE inventory i JOIN room_type rt ON rt.id = i.room_type_id
            SET i.sold_rooms = i.total_rooms + 1 WHERE rt.code = 'FAM-STE' AND i.stay_date = '2026-10-10'`,
      ),
    ).rejects.toThrow(/CONSTRAINT|ck_inventory_sold/i);
  });
});
