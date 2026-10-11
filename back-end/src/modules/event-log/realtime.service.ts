import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

// 운영자 콘솔에 "무엇이 바뀌었다"만 알린다. 데이터는 싣지 않고, 화면은 이 알림을 받아 조회 API로 다시 가져온다 (ADR-0004 결정 4)
export type RealtimeTopic = 'conflict.created' | 'reservation.changed' | 'inventory.changed' | 'sync.changed';

export interface RealtimeMessage {
  topic: RealtimeTopic;
  ids?: number[];
}

@Injectable()
export class RealtimeService {
  private readonly subject = new Subject<RealtimeMessage>();
  readonly stream$ = this.subject.asObservable();

  /** 트랜잭션이 커밋된 뒤에만 호출한다 */
  publish(message: RealtimeMessage): void {
    this.subject.next(message);
  }
}
