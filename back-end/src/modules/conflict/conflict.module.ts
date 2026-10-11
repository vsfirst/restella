import { Module } from '@nestjs/common';
import { EventLogModule } from '../event-log/event-log.module.js';
import { ReservationModule } from '../reservation/reservation.module.js';
import { ConflictController } from './conflict.controller.js';
import { ConflictService } from './conflict.service.js';

@Module({
  imports: [ReservationModule, EventLogModule],
  controllers: [ConflictController],
  providers: [ConflictService],
})
export class ConflictModule {}
