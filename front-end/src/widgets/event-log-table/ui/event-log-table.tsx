'use client';

import Link from 'next/link';
import type { EventPage, EventType, RoomType } from '@/shared/api';
import { cn, EVENT_TYPE_LABEL, formatDateTime } from '@/shared/lib';
import { EmptyRow, EventTypeBadge, PageHeader, TableCard } from '@/shared/ui';
import { useEventLogTableController } from '../lib/use-event-log-table.controller';

const TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[];

/** 이벤트 로그 (S-05, REQ-17). 추가만 되는 기록을 최신순으로 */
export function EventLogTable({ type, cursor, page, roomTypes }: { type?: EventType; cursor?: number; page: EventPage; roomTypes: RoomType[] }) {
  const { events, nextPageHref, firstPageHref } = useEventLogTableController(page, roomTypes, type, cursor);

  return (
    <>
      <PageHeader title="이벤트 로그" description="예약, 충돌, 재고, 채널 동기화에 일어난 일을 시간순으로 보여줍니다. 기록은 수정되지 않습니다." />

      <nav className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="유형 필터">
        <Chip href="/events" active={!type} label="전체" />
        {TYPES.map((t) => (
          <Chip key={t} href={`/events?type=${t}`} active={type === t} label={EVENT_TYPE_LABEL[t]} />
        ))}
      </nav>

      <TableCard>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-56 px-4 py-2.5 font-medium">시각</th>
              <th className="w-32 px-4 py-2.5 font-medium">유형</th>
              <th className="px-4 py-2.5 font-medium">내용</th>
              <th className="w-40 px-4 py-2.5 font-medium">주체</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 && <EmptyRow colSpan={4}>기록이 없습니다.</EmptyRow>}
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-500">{formatDateTime(e.occurredAt)}</td>
                <td className="px-4 py-3">
                  <EventTypeBadge type={e.type} />
                </td>
                <td className="px-4 py-3 text-slate-800">{e.text}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(firstPageHref || nextPageHref) && (
          <div className="flex justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            {firstPageHref ? <Link href={firstPageHref}>← 최신으로</Link> : <span />}
            {nextPageHref && <Link href={nextPageHref}>다음 50건 →</Link>}
          </div>
        )}
      </TableCard>
    </>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn('rounded-full px-3 py-1', active ? 'bg-slate-900 font-medium text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}
    >
      {label}
    </Link>
  );
}
