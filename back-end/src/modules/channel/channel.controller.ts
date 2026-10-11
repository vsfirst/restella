import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ChannelService } from './channel.service.js';
import { ChannelAvailabilityQueryDto } from './dto/channel-availability-query.dto.js';
import { ChannelAvailabilityResponseDto, ChannelResponseDto } from './dto/channel-response.dto.js';

interface AvailabilityRow {
  channelCode: string;
  stayDate: string;
  sentAvailable: number | null;
  sentRevision: string | number;
  sentAt: Date | null;
  desiredAvailable: number;
  desiredRevision: string | number;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
}

@ApiTags('channels')
@ApiBearerAuth()
@Controller('api/v1/channels')
export class ChannelController {
  constructor(
    private readonly channels: ChannelService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get()
  @ApiOkResponse({ type: [ChannelResponseDto] })
  async list(): Promise<ChannelResponseDto[]> {
    const channels = await this.channels.list();
    return channels.map(({ id, code, name, type, active }) => ({ id, code, name, type, active }));
  }

  /** 채널별로 마지막에 보낸 남은 재고와 시각, 전송 대기·재시도 상태 (REQ-20) */
  @Get('availability')
  @ApiOkResponse({ type: [ChannelAvailabilityResponseDto] })
  async availability(@Query() q: ChannelAvailabilityQueryDto): Promise<ChannelAvailabilityResponseDto[]> {
    q.assertRange();
    const rows: AvailabilityRow[] = await this.ds.query(
      `SELECT c.code AS channelCode, ca.stay_date AS stayDate,
              ca.sent_available AS sentAvailable, ca.sent_revision AS sentRevision, ca.sent_at AS sentAt,
              ca.desired_available AS desiredAvailable, ca.desired_revision AS desiredRevision,
              ca.attempts, ca.last_error AS lastError, ca.next_attempt_at AS nextAttemptAt
         FROM channel_availability ca JOIN channel c ON c.id = ca.channel_id
        WHERE ca.room_type_id = ? AND ca.stay_date >= ? AND ca.stay_date <= ?
        ORDER BY c.id, ca.stay_date`,
      [q.roomTypeId, q.from, q.to],
    );
    return rows.map((r) => {
      const sentRevision = Number(r.sentRevision);
      const desiredRevision = Number(r.desiredRevision);
      return {
        channelCode: r.channelCode,
        stayDate: r.stayDate,
        sentAvailable: r.sentAvailable,
        sentRevision,
        sentAt: r.sentAt,
        desiredAvailable: r.desiredAvailable,
        desiredRevision,
        attempts: r.attempts,
        lastError: r.lastError,
        nextAttemptAt: r.nextAttemptAt,
        inSync: sentRevision >= desiredRevision,
      };
    });
  }
}
