import { Column, Entity, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../../common/db/columns.js';

// 채널 × 객실타입 × 숙박일마다 "보내야 할 최신 값(desired)"과 "마지막으로 보낸 값(sent)" (REQ-11, 12, 20)
// 근거: docs/adr/0004-reservation-consistency-and-sync.md
@Entity('channel_availability')
export class ChannelAvailability {
  @PrimaryColumn({ name: 'channel_id', type: 'int', unsigned: true })
  channelId: number;

  @PrimaryColumn({ name: 'room_type_id', type: 'int', unsigned: true })
  roomTypeId: number;

  @PrimaryColumn({ name: 'stay_date', type: 'date' })
  stayDate: string;

  @Column({ name: 'desired_available', type: 'int' })
  desiredAvailable: number;

  @Column({ name: 'desired_revision', type: 'bigint', unsigned: true, transformer: bigintNumber })
  desiredRevision: number;

  @Column({ name: 'sent_available', type: 'int', nullable: true })
  sentAvailable: number | null;

  @Column({ name: 'sent_revision', type: 'bigint', unsigned: true, default: 0, transformer: bigintNumber })
  sentRevision: number;

  @Column({ name: 'changed_at', type: 'datetime', precision: 3 })
  changedAt: Date;

  @Column({ name: 'sent_at', type: 'datetime', precision: 3, nullable: true })
  sentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'datetime', precision: 3 })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
}
