import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const EVENT_TYPES = [
  'RESERVATION_CONFIRMED',
  'RESERVATION_REJECTED',
  'RESERVATION_DUPLICATE',
  'RESERVATION_CONFLICT',
  'RESERVATION_CANCELLED',
  'CONFLICT_CANCELLED',
  'CONFLICT_RESOLVED',
  'CONFLICT_MOVED',
  'INVENTORY_ADJUSTED',
  'SYNC_SUCCEEDED',
  'SYNC_FAILED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// 추가만 하고 수정하지 않는다. 대상이 지워져도 기록이 남도록 외래 키를 걸지 않는다 (REQ-17)
@Entity('event_log')
export class EventLog {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 3 })
  occurredAt: Date;

  @Column({ type: 'enum', enum: EVENT_TYPES })
  type: EventType;

  // SYSTEM | OPERATOR:<id> | CHANNEL:<code> | SIMULATOR:<id>
  @Column({ type: 'varchar', length: 64 })
  actor: string;

  @Column({ name: 'reservation_id', type: 'int', unsigned: true, nullable: true })
  reservationId: number | null;

  @Column({ name: 'channel_id', type: 'int', unsigned: true, nullable: true })
  channelId: number | null;

  @Column({ name: 'room_type_id', type: 'int', unsigned: true, nullable: true })
  roomTypeId: number | null;

  @Column({ type: 'json' })
  detail: Record<string, unknown>;
}
