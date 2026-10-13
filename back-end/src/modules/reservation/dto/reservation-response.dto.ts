import { ApiProperty } from '@nestjs/swagger';
import { CHANNEL_TYPES, type ChannelType } from '../../channel/channel.entity.js';
import { CONFLICT_STATUSES, type ConflictStatus } from '../../conflict/conflict.entity.js';
import { EVENT_TYPES, type EventType } from '../../event-log/event-log.entity.js';
import {
  RECEIVE_RESULTS,
  RESERVATION_STATUSES,
  type ReceiveResult,
  type ReservationStatus,
} from '../reservation.entity.js';

export class ReservationResponseDto {
  id: number;
  channelReservationNo: string;

  /** 체크인 (YYYY-MM-DD) */
  checkIn: string;

  /** 체크아웃 (YYYY-MM-DD) */
  checkOut: string;

  guestName: string;

  /** 현재 상태 */
  @ApiProperty({ enum: RESERVATION_STATUSES })
  status: ReservationStatus;

  /** 처음 받았을 때의 결과. 중복 요청에는 이 값을 그대로 돌려준다 */
  @ApiProperty({ enum: RECEIVE_RESULTS })
  initialResult: ReceiveResult;

  createdAt: Date;
  cancelledAt: Date | null;
  channelId: number;
  channelCode: string;
  channelName: string;

  @ApiProperty({ enum: CHANNEL_TYPES })
  channelType: ChannelType;

  roomTypeId: number;
  roomTypeCode: string;
  roomTypeName: string;

  /** 충돌로 기록된 예약이면 그 충돌의 처리 상태. 충돌이 없었으면 null */
  // OpenAPI 3.0에서 nullable enum은 enum 목록에 null이 있어야 생성 타입에 null이 들어간다
  @ApiProperty({ enum: [...CONFLICT_STATUSES, null], nullable: true })
  conflictStatus: ConflictStatus | null;
}

export class ReservationListResponseDto {
  items: ReservationResponseDto[];

  /** 다음 페이지를 받을 때 cursor로 보낸다. 마지막 페이지면 null */
  nextCursor: string | null;
}

export class ReservationHistoryResponseDto {
  id: number;
  occurredAt: Date;

  @ApiProperty({ enum: EVENT_TYPES })
  type: EventType;

  actor: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  detail: Record<string, unknown>;
}

export class ReservationDetailResponseDto extends ReservationResponseDto {
  /** 재고를 차감하는 숙박일 (YYYY-MM-DD). 체크아웃 날짜는 빠진다 */
  nights: string[];

  /** 이 예약의 이벤트 기록 (오래된 순) */
  history: ReservationHistoryResponseDto[];
}

export class CancelReservationResponseDto {
  reservationId: number;

  @ApiProperty({ enum: ['CANCELLED'] })
  status: 'CANCELLED';

  /** 이번 요청으로 상태가 바뀌었는지. 이미 취소된 예약이면 false (AC-10-2) */
  changed: boolean;

  /** 확정 예약이라 판매 수를 되돌렸는지 */
  inventoryRestored: boolean;

  /** 채널에 취소를 알렸는지. 알릴 필요가 없었으면 null */
  channelNotified: boolean | null;
}

export class MovedReservationResponseDto {
  reservationId: number;
  roomTypeId: number;

  @ApiProperty({ enum: ['CONFIRMED'] })
  status: 'CONFIRMED';
}
