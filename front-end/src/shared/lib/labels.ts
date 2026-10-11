import type { ChannelType, ConflictStatus, EventType, ReservationStatus } from '../api/types';

// 화면에 보이는 도메인 값의 이름. searchParams 검증에도 쓴다

export const CHANNEL_TYPE_LABEL: Record<ChannelType, string> = { CONFIRM: '확인형', NOTIFY: '통보형' };

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  CONFIRMED: '확정',
  CONFLICT: '충돌',
  REJECTED: '거절',
  CANCELLED: '취소',
};

export const CONFLICT_STATUS_LABEL: Record<ConflictStatus, string> = {
  OPEN: '미처리',
  MOVED: '옮김',
  RESOLVED: '해결됨',
  CANCELLED: '취소',
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  RESERVATION_CONFIRMED: '예약 확정',
  RESERVATION_REJECTED: '예약 거절',
  RESERVATION_DUPLICATE: '중복 요청',
  RESERVATION_CONFLICT: '오버부킹 충돌',
  RESERVATION_CANCELLED: '예약 취소',
  CONFLICT_CANCELLED: '충돌 취소',
  CONFLICT_RESOLVED: '충돌 해결됨',
  CONFLICT_MOVED: '충돌 옮김',
  INVENTORY_ADJUSTED: '재고 조정',
  SYNC_SUCCEEDED: '동기화 성공',
  SYNC_FAILED: '동기화 실패',
};
