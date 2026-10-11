import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { requestHash } from '../../common/crypto/signature.js';
import { isDuplicateKey, withLockRetry } from '../../common/db/errors.js';
import { MetricsService } from '../../common/metrics/metrics.service.js';
import { enumerateNights, isCalendarDate } from '../../common/time/stay-dates.js';
import type { Channel } from '../channel/channel.entity.js';
import { ChannelGateway } from '../channel/channel.gateway.js';
import { SyncDispatcher } from '../channel/sync-dispatcher.js';
import { Conflict } from '../conflict/conflict.entity.js';
import type { EventType } from '../event-log/event-log.entity.js';
import { EventLogService } from '../event-log/event-log.service.js';
import { RealtimeService } from '../event-log/realtime.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { RoomTypeService } from '../room-type/room-type.service.js';
import type { CancelReservationResponseDto, MovedReservationResponseDto } from './dto/reservation-response.dto.js';
import { type ReceiveResult, Reservation } from './reservation.entity.js';
import { problem } from '../../common/http/problem.js';

export const MAX_NIGHTS = 30;

export interface ReceiveInput {
  channelReservationNo: string;
  roomTypeCode: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
}

export interface ReceiveOutcome {
  reservationId: number;
  result: ReceiveResult;
  replayed: boolean;
}

const RESULT_EVENT: Record<ReceiveResult, EventType> = {
  CONFIRMED: 'RESERVATION_CONFIRMED',
  REJECTED: 'RESERVATION_REJECTED',
  CONFLICT: 'RESERVATION_CONFLICT',
};

interface CancelOptions {
  actor: string;
  operatorId?: number;
  /** 운영자가 취소하면 채널에도 알린다. 채널이 보낸 취소는 되돌려 알리지 않는다 */
  notifyChannel: boolean;
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly inventory: InventoryService,
    private readonly roomTypes: RoomTypeService,
    private readonly events: EventLogService,
    private readonly realtime: RealtimeService,
    private readonly dispatcher: SyncDispatcher,
    private readonly gateway: ChannelGateway,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * 채널 예약 수신 (REQ-04~08). 흐름과 잠금 순서: docs/2-design/domain-model.md "예약 수신"
   * 1) 예약 행 INSERT로 (채널, 예약번호)를 먼저 차지한다 → 중복이면 유일키 충돌
   * 2) 재고 행을 날짜순으로 잠근다 → 모든 숙박일에 재고가 있을 때만 차감한다 (전부 아니면 전무)
   */
  async receive(channel: Channel, input: ReceiveInput): Promise<ReceiveOutcome> {
    if (!isCalendarDate(input.checkIn) || !isCalendarDate(input.checkOut)) {
      throw problem('validation', '날짜는 YYYY-MM-DD 형식이어야 한다');
    }
    const nights = enumerateNights(input.checkIn, input.checkOut);
    if (nights.length === 0) throw problem('validation', 'checkOut은 checkIn보다 뒤여야 한다'); // AC-01-2
    if (nights.length > MAX_NIGHTS) throw problem('validation', `한 예약은 최대 ${MAX_NIGHTS}박이다`);
    const roomType = await this.roomTypes.findByCode(input.roomTypeCode);
    if (!roomType) throw problem('unknown-room-type');

    const hash = requestHash({ ...input });
    let outcome: ReceiveOutcome;
    try {
      outcome = await withLockRetry(() => this.ds.transaction('READ COMMITTED', async (em) => {
        // 결과가 정해지기 전의 임시 상태로 넣고, 같은 트랜잭션 안에서 확정한다
        const inserted = await em.insert(Reservation, {
          channelId: channel.id,
          channelReservationNo: input.channelReservationNo,
          requestHash: hash,
          roomTypeId: roomType.id,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestName: input.guestName,
          status: 'REJECTED',
          initialResult: 'REJECTED',
        });
        const reservationId = Number(inserted.identifiers[0]?.id);

        const locked = await this.inventory.lockNights(em, roomType.id, input.checkIn, input.checkOut);
        const hasStock = locked.length === nights.length && locked.every((n) => n.soldRooms < n.totalRooms);

        let result: ReceiveResult;
        let remaining: Record<string, number> | undefined;
        if (hasStock) {
          const changes = await this.inventory.applySoldDelta(em, roomType.id, locked, 1);
          remaining = Object.fromEntries(changes.map((c) => [c.stayDate, c.available]));
          result = 'CONFIRMED';
        } else if (channel.type === 'CONFIRM') {
          result = 'REJECTED'; // 확인형: 매진이면 거절 (REQ-06)
        } else {
          result = 'CONFLICT'; // 통보형: 이미 확정된 예약이라 거절할 수 없다. 충돌로 드러낸다 (REQ-07)
          await em.insert(Conflict, { reservationId, status: 'OPEN', detectedAt: new Date() });
        }
        const status = result;
        await em.update(Reservation, { id: reservationId }, { status, initialResult: result });

        await this.events.record(em, {
          type: RESULT_EVENT[result],
          actor: `CHANNEL:${channel.code}`,
          reservationId,
          channelId: channel.id,
          roomTypeId: roomType.id,
          detail: {
            channelReservationNo: input.channelReservationNo,
            roomTypeCode: roomType.code,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            ...(remaining ? { remaining } : { soldOutDates: this.soldOutDates(nights, locked) }),
          },
        });
        return { reservationId, result, replayed: false };
      }));
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      return this.replay(channel, input, hash);
    }

    this.metrics.reservations.inc({ result: outcome.result });
    this.realtime.publish({ topic: 'reservation.changed', ids: [outcome.reservationId] });
    if (outcome.result === 'CONFIRMED') {
      this.realtime.publish({ topic: 'inventory.changed', ids: [roomType.id] });
      this.dispatcher.kick();
    }
    if (outcome.result === 'CONFLICT') this.realtime.publish({ topic: 'conflict.created', ids: [outcome.reservationId] });
    return outcome;
  }

  /** 같은 (채널, 예약번호)가 다시 온 경우: 처음 결과를 그대로 돌려준다 (AC-08-1~3) */
  private async replay(channel: Channel, input: ReceiveInput, hash: string): Promise<ReceiveOutcome> {
    const existing = await this.ds.getRepository(Reservation).findOneByOrFail({
      channelId: channel.id,
      channelReservationNo: input.channelReservationNo,
    });
    if (existing.requestHash !== hash) {
      throw problem('reservation-mismatch', '예약 변경은 지원하지 않는다');
    }
    await this.events.record(this.ds.manager, {
      type: 'RESERVATION_DUPLICATE',
      actor: `CHANNEL:${channel.code}`,
      reservationId: existing.id,
      channelId: channel.id,
      roomTypeId: existing.roomTypeId,
      detail: { channelReservationNo: input.channelReservationNo, initialResult: existing.initialResult },
    });
    this.metrics.reservations.inc({ result: 'DUPLICATE' });
    return { reservationId: existing.id, result: existing.initialResult, replayed: true };
  }

  /** 채널이 보낸 취소 (REQ-10) */
  async cancelByChannel(channel: Channel, channelReservationNo: string): Promise<CancelReservationResponseDto> {
    const r = await this.ds.getRepository(Reservation).findOneBy({ channelId: channel.id, channelReservationNo });
    if (!r) throw problem('not-found', '해당 채널에 그 예약번호가 없다');
    return this.cancel(r.id, { actor: `CHANNEL:${channel.code}`, notifyChannel: false });
  }

  /**
   * 예약 취소 (REQ-10, AC-14-1). 잠금 순서는 예약 → 재고로 수신과 같다.
   * - 확정: 숙박일 판매 수를 1씩 되돌린다
   * - 충돌: 차감한 적이 없으므로 재고는 그대로, 열린 충돌은 '취소'로 닫는다
   * - 이미 취소: 아무것도 바꾸지 않는다 (AC-10-2)
   */
  async cancel(reservationId: number, opts: CancelOptions): Promise<CancelReservationResponseDto> {
    const result = await withLockRetry(() => this.ds.transaction('READ COMMITTED', async (em) => {
      const r = await this.lockReservation(em, reservationId);
      if (r.status === 'CANCELLED') return { reservation: r, changed: false, inventoryRestored: false };
      if (r.status === 'REJECTED') throw problem('reservation-not-cancellable');

      let inventoryRestored = false;
      if (r.status === 'CONFIRMED') {
        const locked = await this.inventory.lockNights(em, r.roomTypeId, r.checkIn, r.checkOut);
        await this.inventory.applySoldDelta(em, r.roomTypeId, locked, -1);
        inventoryRestored = true;
      }
      const events: Parameters<EventLogService['record']>[1] = [];
      if (r.status === 'CONFLICT') {
        const closed = await em.update(
          Conflict,
          { reservationId: r.id, status: 'OPEN' },
          { status: 'CANCELLED', resolvedBy: opts.operatorId ?? null, resolvedAt: new Date() },
        );
        if (closed.affected) {
          events.push({ type: 'CONFLICT_CANCELLED', actor: opts.actor, reservationId: r.id, channelId: r.channelId, roomTypeId: r.roomTypeId });
        }
      }
      const cancelledAt = new Date();
      await em.update(Reservation, { id: r.id }, { status: 'CANCELLED', cancelledAt });
      events.push({
        type: 'RESERVATION_CANCELLED',
        actor: opts.actor,
        reservationId: r.id,
        channelId: r.channelId,
        roomTypeId: r.roomTypeId,
        detail: { previousStatus: r.status, inventoryRestored },
      });
      await this.events.record(em, events);
      return { reservation: r, changed: true, inventoryRestored };
    }));

    let channelNotified: boolean | null = null;
    if (result.changed) {
      this.realtime.publish({ topic: 'reservation.changed', ids: [reservationId] });
      if (result.inventoryRestored) {
        this.realtime.publish({ topic: 'inventory.changed', ids: [result.reservation.roomTypeId] });
        this.dispatcher.kick();
      }
      if (opts.notifyChannel) channelNotified = await this.notifyChannelOfCancellation(result.reservation);
    }
    return {
      reservationId,
      status: 'CANCELLED' as const,
      changed: result.changed,
      inventoryRestored: result.inventoryRestored,
      channelNotified,
    };
  }

  /** 충돌 예약을 같은 숙박일에 재고가 있는 다른 객실타입으로 옮긴다 (REQ-15) */
  async moveConflict(reservationId: number, targetRoomTypeId: number, operatorId: number): Promise<MovedReservationResponseDto> {
    const target = await this.roomTypes.findById(targetRoomTypeId);
    if (!target) throw problem('unknown-room-type');
    const actor = `OPERATOR:${operatorId}`;
    const moved = await this.ds.transaction('READ COMMITTED', async (em) => {
      const r = await this.lockReservation(em, reservationId);
      if (r.status !== 'CONFLICT') throw problem('reservation-not-in-conflict');
      if (r.roomTypeId === target.id) throw problem('same-room-type');
      const nights = enumerateNights(r.checkIn, r.checkOut);
      const locked = await this.inventory.lockNights(em, target.id, r.checkIn, r.checkOut);
      if (locked.length !== nights.length || locked.some((n) => n.soldRooms >= n.totalRooms)) {
        throw problem('insufficient-stock', `${target.name}에 모든 숙박일의 재고가 있지 않다`);
      }
      await this.inventory.applySoldDelta(em, target.id, locked, 1);
      await em.update(Reservation, { id: r.id }, { roomTypeId: target.id, status: 'CONFIRMED' });
      const closed = await em.update(
        Conflict,
        { reservationId: r.id, status: 'OPEN' },
        { status: 'MOVED', resolvedBy: operatorId, resolvedAt: new Date(), resolutionNote: `${target.code}로 이동` },
      );
      if (!closed.affected) throw problem('conflict-already-handled');
      await this.events.record(em, {
        type: 'CONFLICT_MOVED',
        actor,
        reservationId: r.id,
        channelId: r.channelId,
        roomTypeId: target.id,
        detail: { fromRoomTypeId: r.roomTypeId, toRoomTypeCode: target.code },
      });
      return { reservationId: r.id, roomTypeId: target.id, status: 'CONFIRMED' as const };
    });
    this.realtime.publish({ topic: 'reservation.changed', ids: [reservationId] });
    this.realtime.publish({ topic: 'inventory.changed', ids: [target.id] });
    this.dispatcher.kick();
    return moved;
  }

  private async lockReservation(em: EntityManager, id: number): Promise<Reservation> {
    const r = await em
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .setLock('pessimistic_write')
      .where('r.id = :id', { id })
      .getOne();
    if (!r) throw problem('not-found', '예약이 없다');
    return r;
  }

  private async notifyChannelOfCancellation(r: Pick<Reservation, 'id' | 'channelId' | 'channelReservationNo' | 'roomTypeId'>) {
    const channel: { code: string; endpoint_url: string }[] = await this.ds.query(
      'SELECT code, endpoint_url FROM channel WHERE id = ?',
      [r.channelId],
    );
    try {
      await this.gateway.sendCancellation(channel[0].code, channel[0].endpoint_url, {
        channelReservationNo: r.channelReservationNo,
        reason: 'CANCELLED_BY_PROPERTY',
      });
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`채널 취소 통지 실패: ${channel[0].code} ${r.channelReservationNo} (${error})`);
      await this.events.record(this.ds.manager, {
        type: 'SYNC_FAILED',
        actor: 'SYSTEM',
        reservationId: r.id,
        channelId: r.channelId,
        roomTypeId: r.roomTypeId,
        detail: { kind: 'cancellation', channel: channel[0].code, error },
      });
      return false;
    }
  }

  private soldOutDates(nights: string[], locked: { stayDate: string; soldRooms: number; totalRooms: number }[]): string[] {
    const byDate = new Map(locked.map((n) => [n.stayDate, n]));
    return nights.filter((d) => {
      const n = byDate.get(d);
      return !n || n.soldRooms >= n.totalRooms;
    });
  }
}
