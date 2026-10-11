'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Channel, ReservationDetail, ReservationFilters, ReservationPage, ReservationStatus } from '@/shared/api';
import { cn, formatDateTime, formatStay, RESERVATION_STATUS_LABEL } from '@/shared/lib';
import { buttonClass, ChannelBadge, Drawer, EmptyRow, PageHeader, ReservationStatusBadge, TableCard } from '@/shared/ui';
import { useReservationBoardController } from '../lib/use-reservation-board.controller';
import { ReservationDetailView } from './reservation-detail';

const STATUSES = Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[];

interface Props {
  filters: ReservationFilters;
  cursor?: number;
  page: ReservationPage;
  channels: Channel[];
  /** URL의 ?id=로 고른 예약. 서버가 받아서 넘긴다 */
  selected?: ReservationDetail;
}

/** 예약 목록 (S-03, REQ-16) */
export function ReservationBoard({ filters, cursor, page, channels, selected }: Props) {
  const { applyFilters, openDetail, closeDetail, nextPageHref, firstPageHref } = useReservationBoardController(filters, cursor, page.nextCursor);

  return (
    <>
      <PageHeader title="예약 목록" description="모든 채널에서 들어온 예약입니다. 행을 누르면 상세와 이력을 보고 취소할 수 있습니다." />

      <form onSubmit={applyFilters} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <Field label="채널">
          <select name="channelId" defaultValue={filters.channelId ?? ''} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
            <option value="">전체 채널</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="상태">
          <select name="status" defaultValue={filters.status ?? ''} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
            <option value="">전체 (확정·충돌·거절·취소)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESERVATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="숙박 기간 (겹치는 예약)">
          <span className="flex items-center gap-1">
            <input type="date" name="from" defaultValue={filters.from} className="rounded-md border border-slate-300 bg-white px-2 py-1" />~
            <input type="date" name="to" defaultValue={filters.to} className="rounded-md border border-slate-300 bg-white px-2 py-1" />
          </span>
        </Field>
        <button type="submit" className={cn(buttonClass.primary, 'py-1.5')}>
          조회
        </button>
      </form>

      <TableCard>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              {['예약 ID', '채널', '채널 예약번호', '객실타입', '숙박', '손님', '상태', '접수 시각'].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page.items.length === 0 && <EmptyRow colSpan={8}>조건에 맞는 예약이 없습니다.</EmptyRow>}
            {page.items.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r.id)} className={cn('cursor-pointer hover:bg-slate-50', r.id === selected?.id && 'bg-slate-50')}>
                <td className="px-4 py-3 font-medium">#{r.id}</td>
                <td className="px-4 py-3">
                  <ChannelBadge name={r.channelName} type={r.channelType} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.channelReservationNo}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.roomTypeName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatStay(r.checkIn, r.checkOut)}</td>
                <td className="px-4 py-3">{r.guestName}</td>
                <td className="px-4 py-3">
                  <ReservationStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-500">{formatDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager firstHref={firstPageHref} nextHref={nextPageHref} />
      </TableCard>

      {selected && (
        <Drawer caption="S-03a 예약 상세·취소 (REQ-10, 16)" title={`예약 #${selected.id}`} onClose={closeDetail}>
          <ReservationDetailView reservation={selected} />
        </Drawer>
      )}
    </>
  );
}

/** cursor 방식 페이지 이동. 서버가 그 페이지를 다시 그린다 */
function Pager({ firstHref, nextHref }: { firstHref: string | null; nextHref: string | null }) {
  if (!firstHref && !nextHref) return null;
  return (
    <div className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      {firstHref ? <Link href={firstHref}>← 최신으로</Link> : <span />}
      {nextHref && <Link href={nextHref}>다음 50건 →</Link>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}
