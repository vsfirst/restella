import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CurrentOperator } from '../../common/auth/current-operator.decorator.js';
import type { OperatorPrincipal } from '../../common/auth/operator-auth.guard.js';
import { enumerateNights } from '../../common/time/stay-dates.js';
import type { ChannelType } from '../channel/channel.entity.js';
import type { EventType } from '../event-log/event-log.entity.js';
import { ListReservationsQueryDto } from './dto/list-reservations-query.dto.js';
import {
  CancelReservationResponseDto,
  ReservationDetailResponseDto,
  ReservationListResponseDto,
  type ReservationResponseDto,
} from './dto/reservation-response.dto.js';
import type { ReceiveResult, ReservationStatus } from './reservation.entity.js';
import { ReservationService } from './reservation.service.js';
import { problem } from '../../common/http/problem.js';

const SELECT = `
  SELECT r.id, r.channel_reservation_no AS channelReservationNo, r.check_in AS checkIn, r.check_out AS checkOut,
         r.guest_name AS guestName, r.status, r.initial_result AS initialResult, r.created_at AS createdAt,
         r.cancelled_at AS cancelledAt,
         c.id AS channelId, c.code AS channelCode, c.name AS channelName, c.type AS channelType,
         rt.id AS roomTypeId, rt.code AS roomTypeCode, rt.name AS roomTypeName
    FROM reservation r
    JOIN channel c ON c.id = r.channel_id
    JOIN room_type rt ON rt.id = r.room_type_id`;

interface ReservationRow {
  id: number | string;
  channelReservationNo: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: ReservationStatus;
  initialResult: ReceiveResult;
  createdAt: Date;
  cancelledAt: Date | null;
  channelId: number | string;
  channelCode: string;
  channelName: string;
  channelType: ChannelType;
  roomTypeId: number | string;
  roomTypeCode: string;
  roomTypeName: string;
}

interface HistoryRow {
  id: number | string;
  occurredAt: Date;
  type: EventType;
  actor: string;
  detail: string | Record<string, unknown>;
}

const toReservationResponse = (r: ReservationRow): ReservationResponseDto => ({
  id: Number(r.id),
  channelReservationNo: r.channelReservationNo,
  checkIn: r.checkIn,
  checkOut: r.checkOut,
  guestName: r.guestName,
  status: r.status,
  initialResult: r.initialResult,
  createdAt: r.createdAt,
  cancelledAt: r.cancelledAt,
  channelId: Number(r.channelId),
  channelCode: r.channelCode,
  channelName: r.channelName,
  channelType: r.channelType,
  roomTypeId: Number(r.roomTypeId),
  roomTypeCode: r.roomTypeCode,
  roomTypeName: r.roomTypeName,
});

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('api/v1/reservations')
export class ReservationController {
  constructor(
    private readonly reservations: ReservationService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /** 예약 목록 (REQ-16). 최신순, cursor는 마지막으로 받은 id */
  @Get()
  @ApiOkResponse({ type: ReservationListResponseDto })
  async list(@Query() q: ListReservationsQueryDto): Promise<ReservationListResponseDto> {
    const where: string[] = [];
    const params: unknown[] = [];
    const filter = (sql: string, value: unknown) => {
      where.push(sql);
      params.push(value);
    };
    if (q.channelId) filter('r.channel_id = ?', q.channelId);
    if (q.status) filter('r.status = ?', q.status);
    if (q.to) filter('r.check_in <= ?', q.to);
    if (q.from) filter('r.check_out > ?', q.from);
    if (q.cursor) filter('r.id < ?', q.cursor);
    const rows: ReservationRow[] = await this.ds.query(
      `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id DESC LIMIT ?`,
      [...params, q.limit],
    );
    const items = rows.map(toReservationResponse);
    return { items, nextCursor: items.length === q.limit ? String(items.at(-1)!.id) : null };
  }

  /** 예약 상세: 숙박일과 이력 (S-03a) */
  @Get(':id')
  @ApiOkResponse({ type: ReservationDetailResponseDto })
  async get(@Param('id', ParseIntPipe) id: number): Promise<ReservationDetailResponseDto> {
    const [row]: ReservationRow[] = await this.ds.query(`${SELECT} WHERE r.id = ?`, [id]);
    if (!row) throw problem('not-found', '예약이 없다');
    const history: HistoryRow[] = await this.ds.query(
      `SELECT id, occurred_at AS occurredAt, type, actor, detail FROM event_log WHERE reservation_id = ? ORDER BY id`,
      [id],
    );
    return Object.assign(toReservationResponse(row), {
      nights: enumerateNights(row.checkIn, row.checkOut),
      history: history.map((h) => ({
        id: Number(h.id),
        occurredAt: h.occurredAt,
        type: h.type,
        actor: h.actor,
        detail: typeof h.detail === 'string' ? (JSON.parse(h.detail) as Record<string, unknown>) : h.detail,
      })),
    });
  }

  /** 운영자 취소 (REQ-10). 채널에도 취소를 알린다 */
  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: CancelReservationResponseDto })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentOperator() operator: OperatorPrincipal): Promise<CancelReservationResponseDto> {
    return this.reservations.cancel(id, { actor: `OPERATOR:${operator.id}`, operatorId: operator.id, notifyChannel: true });
  }
}
