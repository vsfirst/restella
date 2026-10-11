import { ApiProperty } from '@nestjs/swagger';
import { CHANNEL_TYPES, type ChannelType } from '../channel.entity.js';

export class ChannelResponseDto {
  id: number;
  code: string;
  name: string;

  /** CONFIRM: 확정 전에 재고를 묻는 확인형, NOTIFY: 먼저 확정하고 알려 오는 통보형 */
  @ApiProperty({ enum: CHANNEL_TYPES })
  type: ChannelType;

  active: boolean;
}

export class ChannelAvailabilityResponseDto {
  channelCode: string;

  /** 숙박일 (YYYY-MM-DD) */
  stayDate: string;

  /** 채널에 마지막으로 보낸 남은 재고. 아직 보낸 적이 없으면 null */
  sentAvailable: number | null;

  sentRevision: number;
  sentAt: Date | null;

  /** 보내야 하는 최신 남은 재고 */
  desiredAvailable: number;

  desiredRevision: number;

  /** 연속 실패 횟수 */
  attempts: number;

  lastError: string | null;
  nextAttemptAt: Date;

  /** 채널이 최신 값을 받았는지 (sentRevision ≥ desiredRevision) */
  inSync: boolean;
}
