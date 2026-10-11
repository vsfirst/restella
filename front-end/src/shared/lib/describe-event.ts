import type { EventLog } from '../api/types';
import { formatStay, monthDay } from './dates';

const RESULT_LABEL: Record<string, string> = { CONFIRMED: '확정', REJECTED: '거절', CONFLICT: '충돌' };

type Detail = Record<string, unknown>;
const str = (d: Detail, k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
const num = (d: Detail, k: string) => (typeof d[k] === 'number' ? (d[k] as number) : undefined);

/** 이벤트 한 건을 운영자가 읽을 문장으로 바꾼다. roomTypeCode는 detail에 없을 때 id로 찾는다 */
export function describeEvent(event: EventLog, roomTypeCode: (id: number) => string | undefined = () => undefined): string {
  const d = event.detail;
  const room = str(d, 'roomTypeCode') || (event.roomTypeId ? roomTypeCode(event.roomTypeId) : undefined) || '';
  const stay = str(d, 'checkIn') && str(d, 'checkOut') ? formatStay(str(d, 'checkIn'), str(d, 'checkOut')) : '';
  const head = [str(d, 'channelReservationNo'), [room, stay].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const soldOut = Array.isArray(d.soldOutDates) ? (d.soldOutDates as string[]).map(monthDay).join(', ') : '';

  switch (event.type) {
    case 'RESERVATION_CONFIRMED': {
      const remaining = d.remaining && typeof d.remaining === 'object' ? Object.entries(d.remaining as Record<string, number>) : [];
      const left = remaining.map(([date, n]) => `${monthDay(date)} ${n}`).join(', ');
      return `${head} 확정${left ? `, 남은 재고 ${left}` : ''}`;
    }
    case 'RESERVATION_REJECTED':
      return `${head} 매진${soldOut ? `(${soldOut})` : ''}, 확인형이라 거절`;
    case 'RESERVATION_CONFLICT':
      return `${head} 매진${soldOut ? `(${soldOut})` : ''}, 통보형이라 충돌로 기록`;
    case 'RESERVATION_DUPLICATE':
      return `${str(d, 'channelReservationNo')} 재전송 → 처음 결과(${RESULT_LABEL[str(d, 'initialResult')] ?? str(d, 'initialResult')})로 응답, 재고 변화 없음`;
    case 'RESERVATION_CANCELLED':
      return `예약 #${event.reservationId} 취소${d.inventoryRestored ? ', 재고 복원' : ''}`;
    case 'CONFLICT_CANCELLED':
      return `예약 #${event.reservationId}의 충돌을 취소로 처리`;
    case 'CONFLICT_RESOLVED':
      return `충돌 #${num(d, 'conflictId') ?? ''} 해결됨: "${str(d, 'note')}"`;
    case 'CONFLICT_MOVED':
      return `예약 #${event.reservationId}를 ${str(d, 'toRoomTypeCode')}로 옮겨 확정`;
    case 'INVENTORY_ADJUSTED':
      return `${room} ${monthDay(str(d, 'stayDate'))} 총 재고 ${num(d, 'from')} → ${num(d, 'to')} (판매 ${num(d, 'sold')})${str(d, 'source') ? ` · ${str(d, 'source')}` : ''}`;
    case 'SYNC_SUCCEEDED': {
      const channels = Array.isArray(d.channels) ? (d.channels as string[]) : [];
      return `${channels.length}개 채널 · ${room} ${monthDay(str(d, 'stayDate'))} 남은 재고 전송, 최대 지연 ${num(d, 'maxLatencyMs') ?? '-'}ms`;
    }
    case 'SYNC_FAILED':
      if (str(d, 'kind') === 'cancellation') return `${str(d, 'channel')} 취소 통보 실패: ${str(d, 'error')}`;
      return `${str(d, 'channel')} · ${room} ${monthDay(str(d, 'stayDate'))} 전송 실패 (${num(d, 'attempt')}/${num(d, 'maxAttempts')}): ${str(d, 'error')}`;
  }
}
