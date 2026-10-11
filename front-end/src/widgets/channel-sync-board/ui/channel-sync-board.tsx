'use client';

import Link from 'next/link';
import type { Channel, ChannelAvailability, ChannelFaults, InventoryRow, RoomType } from '@/shared/api';
import { cn, formatDateTime, monthDayWithWeekday } from '@/shared/lib';
import { buttonClass, ChannelBadge, PageHeader, TableCard } from '@/shared/ui';
import { useChannelSyncBoardController } from '../lib/use-channel-sync-board.controller';
import { ChannelFaultsPanel } from './channel-faults-panel';

const MAX_ATTEMPTS = 5;

interface Props {
  roomTypeId: number;
  from: string;
  roomTypes: RoomType[];
  channels: Channel[];
  availability: ChannelAvailability[];
  calendar: InventoryRow[];
  faults: ChannelFaults;
}

/** 채널별 재고 (S-07, REQ-20). 원장의 남은 재고와 각 채널이 마지막으로 받은 값을 비교한다 */
export function ChannelSyncBoard({ roomTypeId, from, roomTypes, channels, availability, calendar, faults }: Props) {
  const { to, dates, ledgerAvailable, cellOf, summary, roomTypeHref, prevHref, nextHref } = useChannelSyncBoardController({ roomTypeId, from, availability, calendar });

  return (
    <>
      <Link href="/simulator" className="text-xs text-slate-500 hover:text-slate-700">
        ← 시뮬레이터
      </Link>
      <PageHeader
        title="채널별 재고"
        description="Restella 원장의 남은 재고와 각 채널이 마지막으로 받은 값을 비교합니다. 동기화가 얼마나 빨리 퍼지는지 확인할 수 있습니다."
        actions={
          <div className="flex gap-3">
            <Summary label="동기화 완료" value={`${summary.synced} / ${summary.total}`} />
            <Summary label="전송 대기·재시도" value={`${summary.pending}건`} warn={summary.pending > 0} />
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <nav className="flex rounded-md border border-slate-300 bg-white p-0.5" aria-label="객실타입">
          {roomTypes.map((rt) => (
            <Link
              key={rt.id}
              href={roomTypeHref(rt.id)}
              className={cn('rounded px-3 py-1', rt.id === roomTypeId ? 'bg-slate-900 font-medium text-white' : 'text-slate-600 hover:bg-slate-100')}
            >
              {rt.name}
            </Link>
          ))}
        </nav>
        <Link href={prevHref} className={cn(buttonClass.secondary, 'py-1.5')} aria-label="이전 기간">
          ‹
        </Link>
        <span className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
          {from} ~ {to}
        </span>
        <Link href={nextHref} className={cn(buttonClass.secondary, 'py-1.5')} aria-label="다음 기간">
          ›
        </Link>
      </div>

      <TableCard>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">채널</th>
              {dates.map((d) => (
                <th key={d} className="px-3 py-2.5 font-medium whitespace-nowrap">
                  {monthDayWithWeekday(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-900 text-white">
              <td className="px-4 py-3 font-semibold whitespace-nowrap">Restella 원장</td>
              {dates.map((d) => {
                const v = ledgerAvailable(d);
                return (
                  <td key={d} className="px-3 py-3 font-semibold whitespace-nowrap">
                    {v === null ? '—' : v <= 0 ? '0 · 매진' : v}
                  </td>
                );
              })}
            </tr>
            {channels.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-3">
                  <ChannelBadge name={c.name} type={c.type} />
                </td>
                {dates.map((d) => (
                  <td key={d} className="px-2 py-2">
                    <SyncCell a={cellOf(c.code, d)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <p className="mt-3 text-xs text-slate-500">
        채널은 이미 받은 revision보다 오래된 값이 늦게 도착하면 무시합니다. 실패하면 간격을 늘려 최대 {MAX_ATTEMPTS}회 다시 보냅니다 (REQ-12).
      </p>

      <ChannelFaultsPanel channels={channels} faults={faults} />
    </>
  );
}

function SyncCell({ a }: { a?: ChannelAvailability }) {
  if (!a) return <p className="px-3 py-2 text-xs text-slate-300">변경 없음</p>;
  const received = a.sentAvailable;
  if (!a.inSync) {
    return (
      <div className="rounded-md bg-orange-50 px-3 py-2 ring-1 ring-orange-200" title={a.lastError ?? undefined}>
        <p className="font-semibold whitespace-nowrap text-orange-700">
          {received ?? '—'} <span className="text-xs font-normal">(원장과 다름)</span>
        </p>
        <p className="text-[11px] whitespace-nowrap text-orange-700">
          {a.attempts > 0 ? `재시도 ${a.attempts}/${MAX_ATTEMPTS}` : '전송 대기'}
          {a.attempts >= MAX_ATTEMPTS && ' · 중단'}
        </p>
      </div>
    );
  }
  return (
    <div className={cn('rounded-md px-3 py-2', received === 0 && 'bg-rose-50 ring-1 ring-rose-200')}>
      <p className={cn('font-semibold whitespace-nowrap', received === 0 && 'text-rose-700')}>{received === 0 ? '0 · 판매 중지' : received}</p>
      <p className="text-[11px] whitespace-nowrap text-slate-500">{a.sentAt ? `${formatDateTime(a.sentAt).slice(11)} 수신` : ''}</p>
    </div>
  );
}

function Summary({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('text-lg font-semibold', warn && 'text-orange-600')}>{value}</p>
    </div>
  );
}
