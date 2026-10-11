import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { CHANNEL_HEADER, SIGNATURE_HEADER, sign, TIMESTAMP_HEADER } from '../../src/common/crypto/signature.js';
import { seedDemoData } from '../../src/database/seeds/seed.js';
import { SimulatedChannelsStore } from '../../src/modules/simulator/simulated-channels.store.js';

// 테스트 전용 값. 운영 비밀값이 아니다.
export const OPERATOR_PASSWORD = 'test-operator-password';
export const START_DATE = '2026-10-01';
export const CHANNEL_SECRETS: Record<string, string> = {
  DIRECT: 'test-secret-direct-00000000000000000',
  APPROVAL: 'test-secret-approval-000000000000000',
  OTA_A: 'test-secret-ota-a-0000000000000000000',
  OTA_B: 'test-secret-ota-b-0000000000000000000',
  OTA_C: 'test-secret-ota-c-0000000000000000000',
};

const TABLES = [
  'simulation_run',
  'event_log',
  'conflict',
  'reservation',
  'channel_availability',
  'inventory',
  'channel',
  'room_type',
  'operator',
];

export interface TestContext {
  app: INestApplication;
  baseUrl: string;
  ds: DataSource;
  close: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** 실제 포트로 앱을 띄운다. 시뮬레이터와 동기화 발송기가 HTTP로 자기 자신을 부르기 때문이다 */
export async function startApp(env: Record<string, string> = {}): Promise<TestContext> {
  const db = inject('db');
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: String(port),
    DB_HOST: db.host,
    DB_PORT: String(db.port),
    DB_USER: db.user,
    DB_PASSWORD: db.password,
    DB_NAME: db.database,
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-0000',
    CHANNEL_SECRETS_JSON: JSON.stringify(CHANNEL_SECRETS),
    OUTBOUND_SIGNING_SECRET: 'test-outbound-secret-00000000000000000',
    SIMULATOR_TARGET_URL: baseUrl,
    SIMULATOR_FAULTS_JSON: '{}',
    ...env,
  });

  // ConfigModule.forRoot()는 AppModule을 불러오는 순간 환경변수를 검증하므로, 환경변수를 넣은 뒤에 불러온다
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');
  const app = configureApp(await NestFactory.create(AppModule, { rawBody: true, logger: ['error', 'warn'] }));
  await app.listen(port, '127.0.0.1');
  const ds = app.get(DataSource);
  return {
    app,
    baseUrl,
    ds,
    close: async () => {
      await app.close();
    },
  };
}

/** 모든 테이블을 비우고 데모 데이터를 다시 넣는다 */
export async function resetDb(ctx: TestContext, opts: { days?: number } = {}): Promise<void> {
  await ctx.ds.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of TABLES) await ctx.ds.query(`TRUNCATE TABLE ${t}`);
  await ctx.ds.query('SET FOREIGN_KEY_CHECKS = 1');
  // 가짜 채널이 기억한 값도 지운다. DB를 비우면 revision이 1부터 다시 시작하기 때문이다
  ctx.app.get(SimulatedChannelsStore).reset();
  await seedDemoData(ctx.ds, {
    simulatorBaseUrl: ctx.baseUrl,
    operatorPassword: OPERATOR_PASSWORD,
    days: opts.days ?? 60,
    startDate: START_DATE,
  });
}

export interface ReservationPayload {
  channelReservationNo: string;
  roomTypeCode: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
}

/** 채널처럼 서명해서 보낸다 */
export async function channelPost(
  ctx: TestContext,
  channelCode: string,
  path: string,
  payload: object,
  opts: { secret?: string; timestamp?: number } = {},
): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const body = JSON.stringify(payload);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [CHANNEL_HEADER]: channelCode,
      [TIMESTAMP_HEADER]: String(timestamp),
      [SIGNATURE_HEADER]: sign(opts.secret ?? CHANNEL_SECRETS[channelCode], timestamp, body),
    },
    body,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers };
}

export const reserve = (ctx: TestContext, channelCode: string, payload: ReservationPayload) =>
  channelPost(ctx, channelCode, '/api/v1/channel/reservations', payload);

export function booking(no: string, overrides: Partial<ReservationPayload> = {}): ReservationPayload {
  return {
    channelReservationNo: no,
    roomTypeCode: 'FAM-STE',
    checkIn: '2026-10-10',
    checkOut: '2026-10-11',
    guestName: `테스트 손님 ${no}`,
    ...overrides,
  };
}

export async function login(ctx: TestContext): Promise<string> {
  const res = await fetch(`${ctx.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginId: 'demo-operator', password: OPERATOR_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`로그인 실패 ${res.status}`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export async function operatorApi(
  ctx: TestContext,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export interface NightRow {
  stay_date: string;
  total_rooms: number;
  sold_rooms: number;
}

export async function nights(ctx: TestContext, roomTypeCode: string, from: string, to: string): Promise<NightRow[]> {
  return ctx.ds.query(
    `SELECT i.stay_date, i.total_rooms, i.sold_rooms FROM inventory i JOIN room_type rt ON rt.id = i.room_type_id
      WHERE rt.code = ? AND i.stay_date >= ? AND i.stay_date <= ? ORDER BY i.stay_date`,
    [roomTypeCode, from, to],
  );
}

/** 남은 재고를 정확히 remaining으로 맞춘다 (테스트 준비용, DB 직접) */
export async function setRemaining(ctx: TestContext, roomTypeCode: string, stayDate: string, remaining: number): Promise<void> {
  await ctx.ds.query(
    `UPDATE inventory i JOIN room_type rt ON rt.id = i.room_type_id
        SET i.total_rooms = i.sold_rooms + ? WHERE rt.code = ? AND i.stay_date = ?`,
    [remaining, roomTypeCode, stayDate],
  );
}

export async function waitFor<T>(fn: () => Promise<T | undefined | false>, timeoutMs = 10_000, intervalMs = 100): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`조건을 ${timeoutMs}ms 안에 만족하지 못했다`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
