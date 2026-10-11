'use client';

import Link from 'next/link';
import type { InventoryRow } from '@/shared/api';
import { CALENDAR_DAYS } from '@/shared/config';
import { availabilityTone, cn, monthDay, weekday, weekdayLabel } from '@/shared/lib';
import { buttonClass, PageHeader } from '@/shared/ui';
import { useInventoryCalendarController } from '../lib/use-inventory-calendar.controller';
import { AdjustInventoryDialog } from './adjust-inventory-dialog';

const TONE_CLASS = {
  soldOut: 'bg-rose-100 text-rose-700 ring-rose-300 font-semibold',
  last: 'bg-amber-100 text-amber-800 ring-amber-300',
  open: 'bg-white text-slate-700 ring-slate-200',
  unregistered: 'bg-slate-50 text-slate-300 ring-slate-100',
} as const;

/** 재고 달력 (S-02, REQ-02). 객실타입 × 숙박일, 칸을 누르면 총 재고 조정 */
export function InventoryCalendar({ from, today, rows }: { from: string; today: string; rows: InventoryRow[] }) {
  const { to, dates, links, selected, select, closeDialog } = useInventoryCalendarController(from, today);

  return (
    <>
      <PageHeader
        title="재고 달력"
        description={
          <>
            칸마다 <b>남은 재고 / 총 재고</b>. 칸을 누르면 총 재고를 조정합니다.
          </>
        }
        actions={
          <nav className="flex items-center gap-2 text-sm" aria-label="기간 이동">
            <Link href={links.prev} className={buttonClass.secondary} aria-label="이전 7일">
              ‹
            </Link>
            <span className="rounded-md border border-slate-300 bg-white px-3 py-2">
              {from} ~ {to} ({CALENDAR_DAYS}일)
            </span>
            <Link href={links.next} className={buttonClass.secondary} aria-label="다음 7일">
              ›
            </Link>
            <Link href={links.today} className={buttonClass.secondary}>
              오늘
            </Link>
          </nav>
        }
      />

      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <Legend className="bg-white ring-slate-300" label="여유" />
        <Legend className="bg-amber-100 ring-amber-300" label="1실 남음" />
        <Legend className="bg-rose-100 ring-rose-300" label="매진 (모든 채널 판매 중지)" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium">객실타입</th>
              {dates.map((d) => (
                <th key={d} className={cn('px-1 py-2 font-medium', weekday(d) === 0 && 'text-rose-600', weekday(d) === 6 && 'text-sky-600', d === today && 'underline')}>
                  {monthDay(d).replace('-', '/')}
                  <br />
                  {weekdayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.roomTypeId} className="border-b border-slate-100 last:border-0">
                <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium whitespace-nowrap">
                  {row.name}
                  <br />
                  <span className="text-xs font-normal text-slate-400">{row.code}</span>
                </th>
                {row.days.map((day) => {
                  const tone = availabilityTone(day);
                  const editable = day.total !== null && day.sold !== null;
                  return (
                    <td key={day.stayDate} className="px-1 py-2 text-center">
                      <button
                        type="button"
                        disabled={!editable}
                        data-testid={`cell-${row.code}-${day.stayDate}`}
                        aria-label={`${row.name} ${day.stayDate} 남은 재고 ${day.available ?? '미등록'}`}
                        onClick={() => select(row, day)}
                        className={cn('mx-auto block w-14 rounded-md py-2 ring-1 hover:outline-2 hover:outline-slate-900', TONE_CLASS[tone])}
                      >
                        {tone === 'unregistered' ? '—' : tone === 'soldOut' ? '매진' : (
                          <>
                            {day.available}
                            <span className="text-slate-400">/{day.total}</span>
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">한 번에 최대 31일까지 볼 수 있습니다 (REQ-02). 예약이 들어오면 새로고침하지 않아도 갱신됩니다.</p>

      {selected && (
        <AdjustInventoryDialog
          roomType={{ roomTypeId: selected.row.roomTypeId, name: selected.row.name }}
          day={selected.day}
          onClose={closeDialog}
        />
      )}
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded ring-1', className)} />
      {label}
    </span>
  );
}
