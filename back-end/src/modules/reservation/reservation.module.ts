import { Module } from '@nestjs/common';
import { ChannelModule } from '../channel/channel.module.js';
import { EventLogModule } from '../event-log/event-log.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { RoomTypeModule } from '../room-type/room-type.module.js';
import { ChannelReservationController } from './channel-reservation.controller.js';
import { ReservationController } from './reservation.controller.js';
import { ReservationService } from './reservation.service.js';

@Module({
  imports: [ChannelModule, InventoryModule, RoomTypeModule, EventLogModule],
  controllers: [ChannelReservationController, ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
