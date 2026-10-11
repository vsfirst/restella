import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundSignatureGuard } from './outbound-signature.guard.js';
import { SimulatedChannelsStore } from './simulated-channels.store.js';
import { SimulationRun } from './simulation-run.entity.js';
import { SimulatorReceiverController } from './simulator-receiver.controller.js';
import { SimulatorController } from './simulator.controller.js';
import { SimulatorService } from './simulator.service.js';

// 다른 도메인 모듈을 import하지 않는다 (경계 원칙). 자기 엔티티(simulation_run)만 쓴다.
@Module({
  imports: [TypeOrmModule.forFeature([SimulationRun])],
  controllers: [SimulatorController, SimulatorReceiverController],
  providers: [SimulatorService, SimulatedChannelsStore, OutboundSignatureGuard],
})
export class SimulatorModule {}
