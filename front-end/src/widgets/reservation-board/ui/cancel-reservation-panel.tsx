'use client';

import type { ReservationDetail } from '@/shared/api';
import { buttonClass, ErrorText } from '@/shared/ui';
import { useCancelReservationController } from '../lib/use-cancel-reservation.controller';

/** 예약 취소 (S-03a, REQ-10) */
export function CancelReservationPanel({ reservation }: { reservation: ReservationDetail }) {
  const c = useCancelReservationController(reservation);
  if (!c.cancellable) return null;

  return (
    <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4">
      <p className="text-sm font-medium text-rose-800">예약 취소</p>
      <p className="mt-1 text-xs text-rose-700">{c.description} 채널에도 취소를 알립니다.</p>
      <ErrorText>{c.error}</ErrorText>
      <button type="button" className={`mt-3 w-full ${buttonClass.danger}`} disabled={c.pending} onClick={c.cancel}>
        {c.pending ? '취소 중…' : '예약 취소'}
      </button>
    </div>
  );
}
