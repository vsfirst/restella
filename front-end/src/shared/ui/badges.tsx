import type { ChannelType, ConflictStatus, EventType, ReservationStatus } from '../api/types';
import { cn } from '../lib/cn';
import { CHANNEL_TYPE_LABEL, CONFLICT_STATUS_LABEL, EVENT_TYPE_LABEL, RESERVATION_STATUS_LABEL } from '../lib/labels';

/** 채널 이름과 유형(확인형/통보형) */
export function ChannelBadge({ name, type }: { name: string; type: ChannelType }) {
  const confirm = type === 'CONFIRM';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-medium text-slate-800">{name}</span>
      <span
        className={cn(
          'rounded px-1.5 py-0.5 text-[11px] font-medium ring-1',
          confirm ? 'bg-sky-50 text-sky-700 ring-sky-200' : 'bg-violet-50 text-violet-700 ring-violet-200',
        )}
      >
        {CHANNEL_TYPE_LABEL[type]}
      </span>
    </span>
  );
}

const RESERVATION_STATUS_STYLE: Record<ReservationStatus, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CONFLICT: 'bg-rose-50 text-rose-700 ring-rose-200',
  REJECTED: 'bg-slate-100 text-slate-600 ring-slate-200',
  CANCELLED: 'bg-white text-slate-500 ring-slate-200 line-through',
};

/**
 * 예약 상태. "해결됨"으로 처리한 충돌은 예약이 CONFLICT로 남으므로, 충돌 처리 상태를 붙여 미처리와 구분한다
 */
export function ReservationStatusBadge({ status, conflictStatus }: { status: ReservationStatus; conflictStatus?: ConflictStatus | null }) {
  const handled = status === 'CONFLICT' && conflictStatus != null && conflictStatus !== 'OPEN';
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        handled ? 'bg-slate-50 text-slate-600 ring-slate-200' : RESERVATION_STATUS_STYLE[status],
      )}
    >
      {RESERVATION_STATUS_LABEL[status]}
      {handled && ` · ${CONFLICT_STATUS_LABEL[conflictStatus]}`}
    </span>
  );
}

const EVENT_TYPE_STYLE: Record<EventType, string> = {
  RESERVATION_CONFIRMED: 'bg-emerald-50 text-emerald-700',
  RESERVATION_REJECTED: 'bg-slate-100 text-slate-600',
  RESERVATION_DUPLICATE: 'bg-amber-50 text-amber-700',
  RESERVATION_CONFLICT: 'bg-rose-50 text-rose-700',
  RESERVATION_CANCELLED: 'bg-slate-100 text-slate-500',
  CONFLICT_CANCELLED: 'bg-slate-100 text-slate-700',
  CONFLICT_RESOLVED: 'bg-slate-100 text-slate-700',
  CONFLICT_MOVED: 'bg-slate-100 text-slate-700',
  INVENTORY_ADJUSTED: 'bg-sky-50 text-sky-700',
  SYNC_SUCCEEDED: 'bg-teal-50 text-teal-700',
  SYNC_FAILED: 'bg-orange-50 text-orange-700',
};

export function EventTypeBadge({ type }: { type: EventType }) {
  return <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', EVENT_TYPE_STYLE[type])}>{EVENT_TYPE_LABEL[type]}</span>;
}
