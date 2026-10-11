import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, LessThan, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import type { EventLogListResponseDto } from './dto/event-log-response.dto.js';
import { EventLog, type EventType } from './event-log.entity.js';

export interface EventInput {
  type: EventType;
  actor: string;
  reservationId?: number | null;
  channelId?: number | null;
  roomTypeId?: number | null;
  detail?: Record<string, unknown>;
}

@Injectable()
export class EventLogService {
  constructor(@InjectRepository(EventLog) private readonly repo: Repository<EventLog>) {}

  /** 업무 변경과 같은 트랜잭션 안에서 기록한다. 변경이 롤백되면 기록도 남지 않는다 */
  async record(em: EntityManager, input: EventInput | EventInput[]): Promise<void> {
    const now = new Date();
    const rows = (Array.isArray(input) ? input : [input]).map((e) => ({
      occurredAt: now,
      type: e.type,
      actor: e.actor,
      reservationId: e.reservationId ?? null,
      channelId: e.channelId ?? null,
      roomTypeId: e.roomTypeId ?? null,
      detail: e.detail ?? {},
    }));
    if (rows.length > 0) await em.insert(EventLog, rows as QueryDeepPartialEntity<EventLog>[]);
  }

  /** 최신순 목록. cursor는 마지막으로 받은 id (REQ-17) */
  async list(params: { types?: EventType[]; cursor?: number; limit: number }): Promise<EventLogListResponseDto> {
    const items = await this.repo.find({
      where: {
        ...(params.types?.length ? { type: In(params.types) } : {}),
        ...(params.cursor ? { id: LessThan(params.cursor) } : {}),
      },
      order: { id: 'DESC' },
      take: params.limit,
    });
    return {
      items: items.map(({ id, occurredAt, type, actor, reservationId, channelId, roomTypeId, detail }) => ({
        id,
        occurredAt,
        type,
        actor,
        reservationId,
        channelId,
        roomTypeId,
        detail,
      })),
      nextCursor: items.length === params.limit ? String(items.at(-1)!.id) : null,
    };
  }
}
