import { Module } from '@nestjs/common';
import { ChannelModule } from '../channel/channel.module.js';
import { EventLogModule } from '../event-log/event-log.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [ChannelModule, EventLogModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
