import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLogController } from './event-log.controller.js';
import { EventLog } from './event-log.entity.js';
import { EventLogService } from './event-log.service.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventLog])],
  controllers: [EventLogController],
  providers: [EventLogService, RealtimeService],
  exports: [EventLogService, RealtimeService],
})
export class EventLogModule {}
