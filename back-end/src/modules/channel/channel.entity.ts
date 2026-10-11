import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// CONFIRM(확인형): 매진이면 거절한다. NOTIFY(통보형): 매진이면 충돌로 기록한다.
export const CHANNEL_TYPES = ['CONFIRM', 'NOTIFY'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

@Entity('channel')
export class Channel {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: CHANNEL_TYPES })
  type: ChannelType;

  // 채널 수신 기본 주소. {endpointUrl}/availability(재고 동기화), {endpointUrl}/cancellations(취소 통지)
  // 서명 키는 DB에 두지 않는다 (환경변수)
  @Column({ name: 'endpoint_url', type: 'varchar', length: 500 })
  endpointUrl: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
