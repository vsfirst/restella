import type { ReservationDetail } from '@/shared/api';
import { describeEvent } from '@/shared/lib';

/** 예약 상세 (S-03a): 이력을 운영자가 읽을 문장으로 바꾼다 */
export function useReservationDetailController(reservation: ReservationDetail) {
  return {
    history: reservation.history.map((h) => ({
      ...h,
      text: describeEvent({ ...h, reservationId: reservation.id, channelId: reservation.channelId, roomTypeId: reservation.roomTypeId }),
    })),
  };
}
