import { Controller, Get, type MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, type Observable } from 'rxjs';
import { EventLogListResponseDto } from './dto/event-log-response.dto.js';
import { ListEventsQueryDto } from './dto/list-events-query.dto.js';
import { EventLogService } from './event-log.service.js';
import { RealtimeService } from './realtime.service.js';

@ApiTags('events')
@ApiBearerAuth()
@Controller('api/v1/events')
export class EventLogController {
  constructor(
    private readonly events: EventLogService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  @ApiOkResponse({ type: EventLogListResponseDto })
  list(@Query() q: ListEventsQueryDto): Promise<EventLogListResponseDto> {
    return this.events.list({ types: q.type, cursor: q.cursor, limit: q.limit });
  }

  /** SSE: 바뀐 대상만 알린다 (REQ-13 AC-13-2). 15초마다 연결 유지 신호를 보낸다 */
  @Sse('stream')
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'event 이름: conflict.created · reservation.changed · inventory.changed · sync.changed · heartbeat. data: {"ids": number[]}',
  })
  stream(): Observable<MessageEvent> {
    return merge(
      this.realtime.stream$.pipe(map((m) => ({ type: m.topic, data: { ids: m.ids ?? [] } }))),
      interval(15_000).pipe(map(() => ({ type: 'heartbeat', data: {} }))),
    );
  }
}
