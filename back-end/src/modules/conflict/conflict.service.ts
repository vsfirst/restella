import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { EventLogService } from '../event-log/event-log.service.js';
import { RealtimeService } from '../event-log/realtime.service.js';
import { ReservationService } from '../reservation/reservation.service.js';
import type { ChannelType } from '../channel/channel.entity.js';
import { Conflict, type ConflictStatus } from './conflict.entity.js';
import { problem } from '../../common/http/problem.js';
import type {
  ConflictCancelledResponseDto,
  ConflictListResponseDto,
  ConflictMovedResponseDto,
  ConflictResolvedResponseDto,
} from './dto/conflict-response.dto.js';

interface ConflictRow {
  id: number | string;
  status: ConflictStatus;
  detectedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  resolvedBy: number | string | null;
  reservationId: number | string;
  channelReservationNo: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  channelCode: string;
  channelName: string;
  channelType: ChannelType;
  roomTypeId: number | string;
  roomTypeCode: string;
  roomTypeName: string;
}

@Injectable()
export class ConflictService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly reservations: ReservationService,
    private readonly events: EventLogService,
    private readonly realtime: RealtimeService,
  ) {}

  /** 충돌 처리함 (REQ-13). 미처리(OPEN)가 기본이다 */
  async list(status: ConflictStatus, limit: number): Promise<ConflictListResponseDto> {
    const rows: ConflictRow[] = await this.ds.query(
      `SELECT cf.id, cf.status, cf.detected_at AS detectedAt, cf.resolved_at AS resolvedAt,
              cf.resolution_note AS resolutionNote, cf.resolved_by AS resolvedBy,
              r.id AS reservationId, r.channel_reservation_no AS channelReservationNo,
              r.check_in AS checkIn, r.check_out AS checkOut, r.guest_name AS guestName,
              c.code AS channelCode, c.name AS channelName, c.type AS channelType,
              rt.id AS roomTypeId, rt.code AS roomTypeCode, rt.name AS roomTypeName
         FROM conflict cf
         JOIN reservation r ON r.id = cf.reservation_id
         JOIN channel c ON c.id = r.channel_id
         JOIN room_type rt ON rt.id = r.room_type_id
        WHERE cf.status = ?
        ORDER BY cf.detected_at DESC, cf.id DESC
        LIMIT ?`,
      [status, limit],
    );
    const [{ open }]: { open: string }[] = await this.ds.query(`SELECT COUNT(*) AS open FROM conflict WHERE status = 'OPEN'`);
    return {
      openCount: Number(open),
      items: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        detectedAt: r.detectedAt,
        resolvedAt: r.resolvedAt,
        resolutionNote: r.resolutionNote,
        resolvedBy: r.resolvedBy === null ? null : Number(r.resolvedBy),
        reservationId: Number(r.reservationId),
        channelReservationNo: r.channelReservationNo,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        guestName: r.guestName,
        channelCode: r.channelCode,
        channelName: r.channelName,
        channelType: r.channelType,
        roomTypeId: Number(r.roomTypeId),
        roomTypeCode: r.roomTypeCode,
        roomTypeName: r.roomTypeName,
      })),
    };
  }

  /** 해결됨 처리: 숙소 밖에서 해결한 경우. 메모 필수 (AC-14-2) */
  async resolve(id: number, note: string, operatorId: number): Promise<ConflictResolvedResponseDto> {
    const conflict = await this.ds.transaction('READ COMMITTED', async (em) => {
      const c = await em
        .getRepository(Conflict)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .getOne();
      if (!c) throw problem('not-found', '충돌이 없다');
      if (c.status !== 'OPEN') throw problem('conflict-already-handled');
      await em.update(Conflict, { id }, { status: 'RESOLVED', resolutionNote: note, resolvedBy: operatorId, resolvedAt: new Date() });
      await this.events.record(em, {
        type: 'CONFLICT_RESOLVED',
        actor: `OPERATOR:${operatorId}`,
        reservationId: c.reservationId,
        detail: { conflictId: id, note },
      });
      return { reservationId: c.reservationId, status: 'RESOLVED' as const };
    });
    this.realtime.publish({ topic: 'reservation.changed', ids: [conflict.reservationId] });
    return { id, status: conflict.status };
  }

  /** 취소로 처리: 예약을 취소하고 채널에 알린다 (AC-14-1) */
  async cancel(id: number, operatorId: number): Promise<ConflictCancelledResponseDto> {
    const c = await this.findOpen(id);
    const result = await this.reservations.cancel(c.reservationId, {
      actor: `OPERATOR:${operatorId}`,
      operatorId,
      notifyChannel: true,
    });
    return { id, status: 'CANCELLED' as const, channelNotified: result.channelNotified };
  }

  /** 다른 객실타입으로 옮기기 (REQ-15) */
  async move(id: number, roomTypeId: number, operatorId: number): Promise<ConflictMovedResponseDto> {
    const c = await this.findOpen(id);
    const moved = await this.reservations.moveConflict(c.reservationId, roomTypeId, operatorId);
    return { id, status: 'MOVED' as const, reservation: moved };
  }

  private async findOpen(id: number): Promise<Conflict> {
    const c = await this.ds.getRepository(Conflict).findOneBy({ id });
    if (!c) throw problem('not-found', '충돌이 없다');
    if (c.status !== 'OPEN') throw problem('conflict-already-handled');
    return c;
  }
}
