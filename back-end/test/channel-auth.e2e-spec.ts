// REQ-09 채널 인증
import { booking, CHANNEL_SECRETS, channelPost, resetDb, startApp, type TestContext } from './support/test-app.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx?.close());
beforeEach(async () => resetDb(ctx));

const PATH = '/api/v1/channel/reservations';

describe('REQ-09 채널 인증', () => {
  it('AC-09-1: 틀린 키로 서명하면 401이고 예약은 생기지 않는다', async () => {
    const res = await channelPost(ctx, 'OTA_A', PATH, booking('A-1'), { secret: 'wrong-secret-wrong-secret-wrong-secret' });
    expect(res.status).toBe(401);
    expect(res.body.type).toBe('urn:restella:problem:invalid-signature');
    const [{ n }] = await ctx.ds.query('SELECT COUNT(*) AS n FROM reservation');
    expect(Number(n)).toBe(0);
  });

  it('AC-09-1: 서명 헤더가 없으면 401', async () => {
    const res = await fetch(`${ctx.baseUrl}${PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-restella-channel': 'OTA_A' },
      body: JSON.stringify(booking('A-1')),
    });
    expect(res.status).toBe(401);
  });

  it('AC-09-2: 한 채널의 키로 다른 채널 이름의 예약을 보낼 수 없다', async () => {
    const res = await channelPost(ctx, 'DIRECT', PATH, booking('X-1'), { secret: CHANNEL_SECRETS.OTA_A });
    expect(res.status).toBe(401);
  });

  it('5분 넘게 지난 요청은 재전송으로 보고 거절한다', async () => {
    const res = await channelPost(ctx, 'OTA_A', PATH, booking('A-1'), { timestamp: Math.floor(Date.now() / 1000) - 301 });
    expect(res.status).toBe(401);
  });

  it('NFR-03 AC-N03-3: 모르는 필드나 형식이 틀린 입력은 400', async () => {
    const extra = await channelPost(ctx, 'OTA_A', PATH, { ...booking('A-1'), price: 1000 });
    expect(extra.status).toBe(400);
    const badDate = await channelPost(ctx, 'OTA_A', PATH, booking('A-2', { checkIn: '2026-13-01' }));
    expect(badDate.status).toBe(400);
    const unknownRoom = await channelPost(ctx, 'OTA_A', PATH, booking('A-3', { roomTypeCode: 'NOPE' }));
    expect(unknownRoom.status).toBe(400);
  });
});
