import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLogModule } from '../event-log/event-log.module.js';
import { AvailabilitySyncWriter } from './availability-sync.writer.js';
import { ChannelAvailability } from './channel-availability.entity.js';
import { ChannelSignatureGuard } from './channel-signature.guard.js';
import { ChannelController } from './channel.controller.js';
import { Channel } from './channel.entity.js';
import { ChannelGateway } from './channel.gateway.js';
import { ChannelService } from './channel.service.js';
import { SyncDispatcher } from './sync-dispatcher.js';

@Module({
  imports: [TypeOrmModule.forFeature([Channel, ChannelAvailability]), EventLogModule],
  controllers: [ChannelController],
  providers: [ChannelService, ChannelSignatureGuard, AvailabilitySyncWriter, ChannelGateway, SyncDispatcher],
  exports: [ChannelService, ChannelSignatureGuard, AvailabilitySyncWriter, ChannelGateway, SyncDispatcher],
})
export class ChannelModule {}
