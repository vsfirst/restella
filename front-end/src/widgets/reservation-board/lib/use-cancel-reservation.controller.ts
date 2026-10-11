import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { clientFetch, endpoints, errorMessage, type ReservationDetail } from '@/shared/api';
import { monthDay } from '@/shared/lib';

/** 예약 취소 (REQ-10). 확정 예약이면 숙박일 재고를 되돌리고 모든 채널에 동기화한다 */
export function useCancelReservationController(reservation: ReservationDetail) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => clientFetch(endpoints.reservationCancel, { path: [reservation.id] }),
    onSuccess: () => router.refresh(),
  });

  const nights = reservation.nights.map(monthDay).join(', ');
  return {
    cancellable: reservation.status === 'CONFIRMED' || reservation.status === 'CONFLICT',
    description:
      reservation.status === 'CONFIRMED'
        ? `취소하면 ${reservation.nights.length}박(${nights})의 재고가 1씩 복원되고, 모든 채널에 남은 재고가 전송됩니다.`
        : '충돌 예약은 재고를 차감하지 않았으므로 재고는 그대로이고, 충돌도 취소로 닫힙니다.',
    pending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
    cancel: () => {
      if (window.confirm(`예약 #${reservation.id}를 취소할까요?`)) mutation.mutate();
    },
  };
}
