import { ApiProperty } from '@nestjs/swagger';
import { CHANNEL_TYPES, type ChannelType } from '../../channel/channel.entity.js';
import { MovedReservationResponseDto } from '../../reservation/dto/reservation-response.dto.js';
import { CONFLICT_STATUSES, type ConflictStatus } from '../conflict.entity.js';

export class ConflictItemResponseDto {
  id: number;

  @ApiProperty({ enum: CONFLICT_STATUSES })
  status: ConflictStatus;

  detectedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;

  /** 처리한 운영자 id */
  resolvedBy: number | null;

  reservationId: number;
  channelReservationNo: string;

  /** 체크인 (YYYY-MM-DD) */
  checkIn: string;

  /** 체크아웃 (YYYY-MM-DD) */
  checkOut: string;

  guestName: string;
  channelCode: string;
  channelName: string;

  @ApiProperty({ enum: CHANNEL_TYPES })
  channelType: ChannelType;

  roomTypeId: number;
  roomTypeCode: string;
  roomTypeName: string;
}

export class ConflictListResponseDto {
  /** 미처리 충돌 수 (콘솔 배지) */
  openCount: number;

  items: ConflictItemResponseDto[];
}

export class ConflictResolvedResponseDto {
  id: number;

  @ApiProperty({ enum: ['RESOLVED'] })
  status: 'RESOLVED';
}

export class ConflictCancelledResponseDto {
  id: number;

  @ApiProperty({ enum: ['CANCELLED'] })
  status: 'CANCELLED';

  /** 채널에 취소를 알렸는지. 알리지 못했으면 false */
  channelNotified: boolean | null;
}

export class ConflictMovedResponseDto {
  id: number;

  @ApiProperty({ enum: ['MOVED'] })
  status: 'MOVED';

  reservation: MovedReservationResponseDto;
}
