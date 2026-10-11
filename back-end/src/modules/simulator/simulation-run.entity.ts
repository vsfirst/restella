import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SimulationResultResponseDto } from './dto/simulation-response.dto.js';

// 시뮬레이터 자신의 기록 (REQ-19). 다른 도메인 테이블은 참조하지 않는다.
@Entity('simulation_run')
export class SimulationRun {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'room_type_id', type: 'int', unsigned: true })
  roomTypeId: number;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  @Column({ name: 'request_count', type: 'int' })
  requestCount: number;

  @Column({ name: 'notify_ratio', type: 'int' })
  notifyRatio: number;

  @Column({ name: 'duplicate_ratio', type: 'int' })
  duplicateRatio: number;

  @Column({ name: 'prepare_remaining', type: 'int', nullable: true })
  prepareRemaining: number | null;

  @Column({ type: 'json', nullable: true })
  result: SimulationResultResponseDto | null;

  @Column({ name: 'started_at', type: 'datetime', precision: 3 })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'datetime', precision: 3, nullable: true })
  finishedAt: Date | null;
}
