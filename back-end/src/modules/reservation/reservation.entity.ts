import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const RESERVATION_STATUSES = ['CONFIRMED', 'REJECTED', 'CONFLICT', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// 처음 처리 결과. 상태는 이후 취소 등으로 바뀌지만, 같은 요청이 다시 오면 이 값을 돌려준다 (AC-08-2)
export const RECEIVE_RESULTS = ['CONFIRMED', 'REJECTED', 'CONFLICT'] as const;
export type ReceiveResult = (typeof RECEIVE_RESULTS)[number];

@Entity('reservation')
export class Reservation {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'channel_id', type: 'int', unsigned: true })
  channelId: number;

  // UNIQUE(channel_id, channel_reservation_no): 중복 요청 판별의 근거 (REQ-08)
  @Column({ name: 'channel_reservation_no', type: 'varchar', length: 64 })
  channelReservationNo: string;

  // 요청 본문의 SHA-256. 같은 번호로 다른 내용이 오면 오류로 처리한다
  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ name: 'room_type_id', type: 'int', unsigned: true })
  roomTypeId: number;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  // 표시용 이름만 저장한다. 연락처는 저장하지 않는다 (NFR-04)
  @Column({ name: 'guest_name', type: 'varchar', length: 100 })
  guestName: string;

  @Column({ type: 'enum', enum: RESERVATION_STATUSES })
  status: ReservationStatus;

  @Column({ name: 'initial_result', type: 'enum', enum: RECEIVE_RESULTS })
  initialResult: ReceiveResult;

  @Column({ name: 'cancelled_at', type: 'datetime', precision: 3, nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
