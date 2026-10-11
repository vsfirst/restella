import { ApiProperty } from '@nestjs/swagger';
import { EVENT_TYPES, type EventType } from '../event-log.entity.js';

export class EventLogResponseDto {
  id: number;
  occurredAt: Date;

  @ApiProperty({ enum: EVENT_TYPES })
  type: EventType;

  /** 누가 일으켰는지. 예: CHANNEL:OTA_A, OPERATOR:1, SYSTEM */
  actor: string;

  reservationId: number | null;
  channelId: number | null;
  roomTypeId: number | null;

  /** 유형별 상세 값 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  detail: Record<string, unknown>;
}

export class EventLogListResponseDto {
  items: EventLogResponseDto[];

  /** 다음 페이지를 받을 때 cursor로 보낸다. 마지막 페이지면 null */
  nextCursor: string | null;
}
