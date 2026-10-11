import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumber } from '../../common/db/columns.js';

// 객실타입 × 숙박일 재고 (REQ-01). 판매 수 ≤ 총 재고는 DB CHECK 제약으로도 보장한다 (NFR-01).
@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'room_type_id', type: 'int', unsigned: true })
  roomTypeId: number;

  // 'YYYY-MM-DD' 문자열 (Asia/Seoul 기준 숙박일, NFR-08)
  @Column({ name: 'stay_date', type: 'date' })
  stayDate: string;

  @Column({ name: 'total_rooms', type: 'int' })
  totalRooms: number;

  @Column({ name: 'sold_rooms', type: 'int' })
  soldRooms: number;

  // 재고가 바뀔 때마다 1씩 는다. 채널 동기화의 최신 값 판별에 쓴다 (AC-12-3)
  @Column({ type: 'bigint', unsigned: true, transformer: bigintNumber })
  revision: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
