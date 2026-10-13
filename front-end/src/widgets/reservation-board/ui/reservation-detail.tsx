'use client';

import type { ReactNode } from 'react';
import type { ReservationDetail } from '@/shared/api';
import { formatDateTime, monthDay } from '@/shared/lib';
import { ChannelBadge, EventTypeBadge, ReservationStatusBadge } from '@/shared/ui';
import { useReservationDetailController } from '../lib/use-reservation-detail.controller';
import { CancelReservationPanel } from './cancel-reservation-panel';

/** 예약 상세와 이력 (S-03a) */
export function ReservationDetailView({ reservation: r }: { reservation: ReservationDetail }) {
  const { history } = useReservationDetailController(r);
  return (
    <>
      <dl className="mt-5 space-y-3 text-sm">
        <Row label="상태">
          <ReservationStatusBadge status={r.status} conflictStatus={r.conflictStatus} />
        </Row>
        <Row label="채널">
          <ChannelBadge name={r.channelName} type={r.channelType} />
        </Row>
        <Row label="채널 예약번호">
          <span className="font-mono text-xs">{r.channelReservationNo}</span>
        </Row>
        <Row label="객실타입">{r.roomTypeName}</Row>
        <Row label="숙박">
          {r.checkIn} → {r.checkOut} ({r.nights.length}박)
        </Row>
        <Row label={r.status === 'CONFIRMED' ? '차감된 숙박일' : '숙박일'}>{r.nights.map(monthDay).join(', ')}</Row>
        <Row label="손님">{r.guestName}</Row>
      </dl>

      <h3 className="mt-6 text-sm font-semibold">이력</h3>
      <ol className="mt-2 space-y-3 border-l border-slate-200 pl-4 text-sm">
        {history.map((h) => (
          <li key={h.id}>
            <EventTypeBadge type={h.type} />
            <p className="mt-1 text-slate-800">{h.text}</p>
            <p className="font-mono text-xs text-slate-500">
              {formatDateTime(h.occurredAt)} · {h.actor}
            </p>
          </li>
        ))}
      </ol>

      <CancelReservationPanel reservation={r} />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
