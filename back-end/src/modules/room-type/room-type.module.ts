import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomTypeController } from './room-type.controller.js';
import { RoomType } from './room-type.entity.js';
import { RoomTypeService } from './room-type.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([RoomType])],
  controllers: [RoomTypeController],
  providers: [RoomTypeService],
  exports: [RoomTypeService],
})
export class RoomTypeModule {}
