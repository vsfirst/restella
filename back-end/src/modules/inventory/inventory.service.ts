import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { withLockRetry } from '../../common/db/errors.js';
import { addDays } from '../../common/time/stay-dates.js';
import { type AvailabilityChange, AvailabilitySyncWriter } from '../channel/availability-sync.writer.js';
import { SyncDispatcher } from '../channel/sync-dispatcher.js';
import { EventLogService } from '../event-log/event-log.service.js';
import { RealtimeService } from '../event-log/realtime.service.js';
import type { AdjustInventoryResponseDto, InventoryCalendarResponseDto } from './dto/inventory-response.dto.js';
import { problem } from '../../common/http/problem.js';

export interface LockedNight {
  id: number;
  stayDate: string;
  totalRooms: number;
  soldRooms: number;
  revision: number;
}

interface RawNight {
  id: string;
  stay_date: string;
  total_rooms: number;
  sold_rooms: number;
  revision: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly sync: AvailabilitySyncWriter,
    private readonly dispatcher: SyncDispatcher,
    private readonly events: EventLogService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * 숙박일 재고 행을 날짜 오름차순으로 잠근다 (ADR-0004 결정 1).
   * 잠금 순서가 항상 같아서 날짜가 겹치는 연박끼리 교착이 생기지 않는다 (AC-05-3).
   * 재고가 등록되지 않은 날짜는 결과에 없다. 호출자는 행 수로 매진을 판단한다 (AC-01-3).
   */
  async lockNights(em: EntityManager, roomTypeId: number, checkIn: string, checkOut: string): Promise<LockedNight[]> {
    const rows: RawNight[] = await em.query(
      `SELECT id, stay_date, total_rooms, sold_rooms, revision
         FROM inventory
        WHERE room_type_id = ? AND stay_date >= ? AND stay_date < ?
        ORDER BY stay_date
        FOR UPDATE`,
      [roomTypeId, checkIn, checkOut],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      stayDate: r.stay_date,
      totalRooms: r.total_rooms,
      soldRooms: r.sold_rooms,
      revision: Number(r.revision),
    }));
  }

  /** 잠근 행의 판매 수를 delta만큼 바꾸고, 같은 트랜잭션에서 채널 동기화 상태를 기록한다 */
  async applySoldDelta(em: EntityManager, roomTypeId: number, nights: LockedNight[], delta: 1 | -1): Promise<AvailabilityChange[]> {
    await em.query(`UPDATE inventory SET sold_rooms = sold_rooms + ?, revision = revision + 1 WHERE id IN (?)`, [
      delta,
      nights.map((n) => n.id),
    ]);
    const changes = nights.map((n) => ({
      stayDate: n.stayDate,
      available: n.totalRooms - (n.soldRooms + delta),
      revision: n.revision + 1,
    }));
    await this.sync.markChanged(em, roomTypeId, changes);
    return changes;
  }

  /** 총 재고 조정 (REQ-03). 판매 수보다 작게 줄일 수 없다 (AC-03-2) */
  async adjustTotal(
    roomTypeId: number,
    stayDate: string,
    totalRooms: number,
    actor: string,
    source?: string,
  ): Promise<AdjustInventoryResponseDto> {
    const change = await withLockRetry(() => this.ds.transaction('READ COMMITTED', async (em) => {
      const [night] = await this.lockNights(em, roomTypeId, stayDate, addDays(stayDate, 1));
      if (!night) throw problem('not-found', '해당 날짜의 재고가 없다');
      if (totalRooms < night.soldRooms) {
        throw problem('total-below-sold', `판매 수(${night.soldRooms})보다 작게 줄일 수 없다`);
      }
      await em.query('UPDATE inventory SET total_rooms = ?, revision = revision + 1 WHERE id = ?', [totalRooms, night.id]);
      const changed = { stayDate, available: totalRooms - night.soldRooms, revision: night.revision + 1 };
      await this.sync.markChanged(em, roomTypeId, [changed]);
      await this.events.record(em, {
        type: 'INVENTORY_ADJUSTED',
        actor,
        roomTypeId,
        detail: { stayDate, from: night.totalRooms, to: totalRooms, sold: night.soldRooms, ...(source ? { source } : {}) },
      });
      return { roomTypeId, stayDate, totalRooms, soldRooms: night.soldRooms, available: changed.available, revision: changed.revision };
    }));
    this.realtime.publish({ topic: 'inventory.changed', ids: [roomTypeId] });
    this.dispatcher.kick();
    return change;
  }

  /** 재고 달력 (REQ-02): 객실타입 × 날짜 */
  async calendar(from: string, to: string): Promise<InventoryCalendarResponseDto[]> {
    const roomTypes: { id: string; code: string; name: string }[] = await this.ds.query(
      'SELECT id, code, name FROM room_type ORDER BY id',
    );
    const rows: { room_type_id: string; stay_date: string; total_rooms: number; sold_rooms: number }[] = await this.ds.query(
      `SELECT room_type_id, stay_date, total_rooms, sold_rooms FROM inventory
        WHERE stay_date >= ? AND stay_date <= ? ORDER BY room_type_id, stay_date`,
      [from, to],
    );
    const byKey = new Map(rows.map((r) => [`${r.room_type_id}|${r.stay_date}`, r]));
    const dates: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);

    return roomTypes.map((rt) => ({
      roomTypeId: Number(rt.id),
      code: rt.code,
      name: rt.name,
      days: dates.map((stayDate) => {
        const r = byKey.get(`${rt.id}|${stayDate}`);
        return r
          ? { stayDate, total: r.total_rooms, sold: r.sold_rooms, available: r.total_rooms - r.sold_rooms }
          : { stayDate, total: null, sold: null, available: null }; // 재고 미등록: 판매하지 않는다
      }),
    }));
  }
}
