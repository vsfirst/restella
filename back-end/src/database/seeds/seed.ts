import * as argon2 from 'argon2';
import type { DataSource } from 'typeorm';
import { addDays, todayInSeoul } from '../../common/time/stay-dates.js';

// 데모 데이터. 모든 값은 누가 봐도 가짜다 (docs/2-design/security.md). 여러 번 실행해도 같은 결과다.

export const DEMO_ROOM_TYPES = [
  { code: 'DLX-DBL', name: '디럭스 더블', total: 8 },
  { code: 'STD-TWN', name: '스탠다드 트윈', total: 12 },
  { code: 'FAM-STE', name: '패밀리 스위트', total: 4 },
] as const;

// 실제 회사 이름이 아닌 가짜 채널
export const DEMO_CHANNELS = [
  { code: 'DIRECT', name: '자사 예약', type: 'CONFIRM' },
  { code: 'APPROVAL', name: '승인형 채널', type: 'CONFIRM' },
  { code: 'OTA_A', name: 'OTA A', type: 'NOTIFY' },
  { code: 'OTA_B', name: 'OTA B', type: 'NOTIFY' },
  { code: 'OTA_C', name: 'OTA C', type: 'NOTIFY' },
] as const;

export interface SeedOptions {
  simulatorBaseUrl: string; // 가짜 채널 수신 주소의 기본값 (back-end 자신)
  operatorPassword?: string; // 없으면 운영자 계정을 만들지 않는다
  days?: number; // 오늘부터 며칠치 재고를 만들지
  startDate?: string;
}

export async function seedDemoData(ds: DataSource, opts: SeedOptions): Promise<void> {
  const days = opts.days ?? 90;
  const start = opts.startDate ?? todayInSeoul();

  for (const rt of DEMO_ROOM_TYPES) {
    await ds.query('INSERT INTO room_type (code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [rt.code, rt.name]);
  }
  for (const ch of DEMO_CHANNELS) {
    await ds.query(
      `INSERT INTO channel (code, name, type, endpoint_url) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), endpoint_url = VALUES(endpoint_url)`,
      [ch.code, ch.name, ch.type, `${opts.simulatorBaseUrl}/internal/simulator/channels/${ch.code}`],
    );
  }

  const roomTypes: { id: string; code: string }[] = await ds.query('SELECT id, code FROM room_type');
  const values: unknown[] = [];
  const tuples: string[] = [];
  for (const rt of roomTypes) {
    const total = DEMO_ROOM_TYPES.find((d) => d.code === rt.code)?.total ?? 5;
    for (let i = 0; i < days; i++) {
      tuples.push('(?, ?, ?, 0, 0)');
      values.push(Number(rt.id), addDays(start, i), total);
    }
  }
  // 이미 있는 날짜(판매가 진행된 재고)는 건드리지 않는다
  if (tuples.length) {
    await ds.query(
      `INSERT IGNORE INTO inventory (room_type_id, stay_date, total_rooms, sold_rooms, revision) VALUES ${tuples.join(', ')}`,
      values,
    );
  }

  if (opts.operatorPassword) {
    const hash = await argon2.hash(opts.operatorPassword, { type: argon2.argon2id });
    await ds.query(
      `INSERT INTO operator (login_id, password_hash, name) VALUES ('demo-operator', ?, '데모 운영자')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [hash],
    );
  }
}
