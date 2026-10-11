// REQ-11, 12, 20 채널 동기화
import { booking, login, operatorApi, reserve, resetDb, setRemaining, startApp, type TestContext, waitFor } from './support/test-app.js';

let ctx: TestContext;
let token: string;
beforeAll(async () => {
  ctx = await startApp();
  await resetDb(ctx);
  token = await login(ctx);
});
afterAll(async () => ctx?.close());
beforeEach(async () => {
  await operatorApi(ctx, token, 'PUT', '/api/v1/simulations/faults', { faults: {} });
  await resetDb(ctx);
});

interface Received {
  roomTypeCode: string;
  stayDate: string;
  available: number;
  stopSell: boolean;
  revision: number;
}

async function received(channel: string, roomTypeCode: string, stayDate: string): Promise<Received | undefined> {
  const s = (await (await fetch(`${ctx.baseUrl}/internal/simulator/channels`)).json()) as {
    availability: Record<string, Received[]>;
  };
  return s.availability[channel]?.find((a) => a.roomTypeCode === roomTypeCode && a.stayDate === stayDate);
}

const CHANNELS = ['DIRECT', 'APPROVAL', 'OTA_A', 'OTA_B', 'OTA_C'];

describe('REQ-11 재고가 바뀌면 모든 채널에 남은 수량 전송', () => {
  it('AC-11-1, 11-2: 예약 확정 후 5초 안에 모든 채널이 바뀐 숙박일의 남은 재고를 받는다', async () => {
    const started = Date.now();
    await reserve(ctx, 'OTA_A', booking('A-1', { checkIn: '2026-10-10', checkOut: '2026-10-12' }));
    for (const ch of CHANNELS) {
      for (const d of ['2026-10-10', '2026-10-11']) {
        const r = await waitFor(() => received(ch, 'FAM-STE', d), 5_000, 50);
        expect(r.available).toBe(3);
      }
    }
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('AC-11-3: 남은 재고가 0이 되면 채널은 판매 중지(stopSell)로 받는다', async () => {
    await setRemaining(ctx, 'FAM-STE', '2026-10-10', 1);
    await reserve(ctx, 'DIRECT', booking('D-1'));
    const r = await waitFor(() => received('OTA_B', 'FAM-STE', '2026-10-10'), 5_000);
    expect(r).toMatchObject({ available: 0, stopSell: true });
  });

  it('총 재고 조정(REQ-03)도 동기화된다', async () => {
    const res = await operatorApi(ctx, token, 'PATCH', '/api/v1/inventory/1/2026-10-17', { totalRooms: 6 });
    expect(res.status).toBe(200);
    const r = await waitFor(async () => {
      const x = await received('OTA_C', 'DLX-DBL', '2026-10-17');
      return x?.available === 6 ? x : undefined;
    }, 5_000);
    expect(r.available).toBe(6);
  });
});

describe('REQ-12 동기화 실패 재시도', () => {
  it('AC-12-1, 12-3: 채널이 실패하면 다시 보내고, 그 사이 바뀐 최신 값을 받는다', async () => {
    await operatorApi(ctx, token, 'PUT', '/api/v1/simulations/faults', { faults: { OTA_C: { failureRate: 1 } } });
    await reserve(ctx, 'DIRECT', booking('D-1'));
    await reserve(ctx, 'DIRECT', booking('D-2'));
    // 다른 채널은 받았는데 OTA_C는 실패 중이다
    await waitFor(async () => (await received('OTA_A', 'FAM-STE', '2026-10-10'))?.available === 2, 5_000);
    expect(await received('OTA_C', 'FAM-STE', '2026-10-10')).toBeUndefined();
    const [failing] = await ctx.ds.query(
      `SELECT attempts, last_error FROM channel_availability ca JOIN channel c ON c.id = ca.channel_id
        WHERE c.code = 'OTA_C' AND ca.stay_date = '2026-10-10' AND ca.room_type_id = 3`,
    );
    expect(failing.attempts).toBeGreaterThanOrEqual(1);

    // 장애가 풀리면 재시도로 최신 값(남은 2)을 받는다
    await operatorApi(ctx, token, 'PUT', '/api/v1/simulations/faults', { faults: {} });
    const r = await waitFor(() => received('OTA_C', 'FAM-STE', '2026-10-10'), 10_000);
    expect(r.available).toBe(2);
  });

  it('AC-12-2: 끝내 실패하면(최대 5회) 이벤트 로그에 남는다', async () => {
    await operatorApi(ctx, token, 'PUT', '/api/v1/simulations/faults', { faults: { OTA_C: { failureRate: 1 } } });
    await reserve(ctx, 'DIRECT', booking('D-1'));
    // 재시도 간격 1+2+4+8초 → 약 15초 뒤 마지막 시도
    const final = await waitFor(async () => {
      const rows: { detail: string | Record<string, unknown> }[] = await ctx.ds.query(
        `SELECT detail FROM event_log WHERE type = 'SYNC_FAILED'`,
      );
      return rows
        .map((r) => (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail))
        .find((d) => d.channel === 'OTA_C' && d.attempt === 5 && d.nextRetryInMs === null);
    }, 25_000, 500);
    expect(final).toMatchObject({ attempt: 5, maxAttempts: 5 });
  }, 40_000);
});

describe('REQ-20 채널별 재고 보기', () => {
  it('AC-20-1: 채널별로 마지막에 받은 남은 재고와 받은 시각을 조회한다', async () => {
    await reserve(ctx, 'OTA_A', booking('A-1'));
    // 발송기는 채널 응답을 받은 뒤 "보냄"을 기록하므로, 기록이 끝날 때까지 기다린다
    const rows = await waitFor(async () => {
      const res = await operatorApi(ctx, token, 'GET', '/api/v1/channels/availability?roomTypeId=3&from=2026-10-10&to=2026-10-10');
      return res.status === 200 && res.body.length === 5 && res.body.every((r: { inSync: boolean }) => r.inSync) ? res.body : undefined;
    }, 5_000);
    for (const row of rows) {
      expect(row).toMatchObject({ stayDate: '2026-10-10', sentAvailable: 3, inSync: true });
      expect(row.sentAt).toBeTruthy();
    }
  });
});
