import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export interface AvailabilityChange {
  stayDate: string;
  available: number;
  revision: number;
}

// 재고를 바꾸는 트랜잭션 안에서 "채널마다 보내야 할 최신 값"을 덮어쓴다 (ADR-0004 결정 3).
// 재고 변경과 함께 커밋되므로 서버가 죽어도 동기화가 누락되지 않는다.
@Injectable()
export class AvailabilitySyncWriter {
  async markChanged(em: EntityManager, roomTypeId: number, changes: AvailabilityChange[]): Promise<void> {
    if (changes.length === 0) return;
    const channelRows: { id: string | number }[] = await em.query('SELECT id FROM channel WHERE active = 1');
    if (channelRows.length === 0) return;

    const now = new Date();
    const values: unknown[] = [];
    const tuples: string[] = [];
    for (const { id } of channelRows) {
      for (const c of changes) {
        tuples.push('(?, ?, ?, ?, ?, 0, ?, 0, ?)');
        values.push(Number(id), roomTypeId, c.stayDate, c.available, c.revision, now, now);
      }
    }
    // 같은 행에 더 최신 값이 오면 덮어쓰고 재시도 횟수를 초기화한다.
    // 재고 행을 잠근 상태에서 호출되므로 revision은 단조 증가한다.
    await em.query(
      `INSERT INTO channel_availability
         (channel_id, room_type_id, stay_date, desired_available, desired_revision, sent_revision, changed_at, attempts, next_attempt_at)
       VALUES ${tuples.join(', ')}
       ON DUPLICATE KEY UPDATE
         desired_available = VALUES(desired_available),
         desired_revision = VALUES(desired_revision),
         changed_at = VALUES(changed_at),
         attempts = 0,
         next_attempt_at = VALUES(next_attempt_at),
         last_error = NULL`,
      values,
    );
  }
}
