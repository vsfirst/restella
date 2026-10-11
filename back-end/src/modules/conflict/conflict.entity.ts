import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const CONFLICT_STATUSES = ['OPEN', 'CANCELLED', 'RESOLVED', 'MOVED'] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

// 오버부킹 충돌: 통보형 채널이 매진된 숙박일에 보낸 예약 (REQ-07, 13, 14)
@Entity('conflict')
export class Conflict {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'reservation_id', type: 'int', unsigned: true, unique: true })
  reservationId: number;

  @Column({ type: 'enum', enum: CONFLICT_STATUSES, default: 'OPEN' })
  status: ConflictStatus;

  @Column({ name: 'resolution_note', type: 'varchar', length: 500, nullable: true })
  resolutionNote: string | null;

  @Column({ name: 'resolved_by', type: 'int', unsigned: true, nullable: true })
  resolvedBy: number | null;

  @Column({ name: 'detected_at', type: 'datetime', precision: 3 })
  detectedAt: Date;

  @Column({ name: 'resolved_at', type: 'datetime', precision: 3, nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
