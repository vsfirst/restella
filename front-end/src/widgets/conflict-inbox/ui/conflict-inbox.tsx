'use client';

import Link from 'next/link';
import type { ConflictList, ConflictStatus } from '@/shared/api';
import { cn, CONFLICT_STATUS_LABEL, formatDateTime, formatStay } from '@/shared/lib';
import { buttonClass, ChannelBadge, EmptyRow, PageHeader, TableCard } from '@/shared/ui';
import { useConflictInboxController } from '../lib/use-conflict-inbox.controller';
import { CancelConflictButton } from './cancel-conflict-button';
import { MoveConflictDialog } from './move-conflict-dialog';
import { ResolveConflictDialog } from './resolve-conflict-dialog';

const TABS: ConflictStatus[] = ['OPEN', 'MOVED', 'RESOLVED', 'CANCELLED'];

/** 충돌 처리함 (S-04, REQ-13~15) */
export function ConflictInbox({ status, list }: { status: ConflictStatus; list: ConflictList }) {
  const { isOpenTab: open, isFresh, dialog, openResolve, openMove, closeDialog } = useConflictInboxController(status, list);
  const { items: conflicts, openCount } = list;

  return (
    <>
      <PageHeader
        title="충돌 처리함"
        description="통보형 채널(OTA)이 매진된 날짜에 이미 확정해 버린 예약입니다. 손님이 도착하기 전에 연락해 처리하세요."
        actions={
          <nav className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" aria-label="처리 상태">
            {TABS.map((s) => (
              <Link
                key={s}
                href={s === 'OPEN' ? '/conflicts' : `/conflicts?status=${s}`}
                className={cn('rounded px-3 py-1', s === status ? 'bg-slate-900 font-medium text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {CONFLICT_STATUS_LABEL[s]}
                {s === 'OPEN' && ` ${openCount}`}
              </Link>
            ))}
          </nav>
        }
      />

      <TableCard>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">접수</th>
              <th className="px-4 py-2.5 font-medium">채널</th>
              <th className="px-4 py-2.5 font-medium">채널 예약번호</th>
              <th className="px-4 py-2.5 font-medium">객실타입 · 숙박</th>
              <th className="px-4 py-2.5 font-medium">손님</th>
              <th className="px-4 py-2.5 text-right font-medium">{open ? '처리' : '처리 내용'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {conflicts.length === 0 && <EmptyRow colSpan={6}>{open ? '미처리 충돌이 없습니다.' : '해당하는 충돌이 없습니다.'}</EmptyRow>}
            {conflicts.map((c) => {
              const fresh = isFresh(c.id);
              return (
                <tr key={c.id} data-testid="conflict-row" className={cn(fresh && 'bg-rose-50/60')}>
                  <td className={cn('px-4 py-3 font-mono text-xs whitespace-nowrap', fresh ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                    {formatDateTime(c.detectedAt).slice(5)}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge name={c.channelName} type={c.channelType} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.channelReservationNo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.roomTypeName} · {formatStay(c.checkIn, c.checkOut)}
                  </td>
                  <td className="px-4 py-3">{c.guestName}</td>
                  <td className="px-4 py-3">
                    {open ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" className={buttonClass.small} onClick={() => openMove(c)}>
                          다른 객실타입으로 옮기기
                        </button>
                        <button type="button" className={buttonClass.small} onClick={() => openResolve(c)}>
                          해결됨
                        </button>
                        <CancelConflictButton conflict={c} />
                      </div>
                    ) : (
                      <p className="text-right text-xs text-slate-500">
                        {CONFLICT_STATUS_LABEL[c.status]}
                        {c.resolvedAt && ` · ${formatDateTime(c.resolvedAt).slice(5, 16)}`}
                        {c.resolutionNote && ` · ${c.resolutionNote}`}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
      {open && <p className="mt-3 text-xs text-slate-500">새 충돌은 새로고침하지 않아도 5초 안에 나타납니다 (REQ-13).</p>}

      {dialog?.kind === 'resolve' && <ResolveConflictDialog conflict={dialog.conflict} onClose={closeDialog} />}
      {dialog?.kind === 'move' && <MoveConflictDialog conflict={dialog.conflict} onClose={closeDialog} />}
    </>
  );
}
