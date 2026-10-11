'use client';

import type { Conflict } from '@/shared/api';
import { formatStay } from '@/shared/lib';
import { buttonClass, ErrorText, Modal } from '@/shared/ui';
import { useMoveConflictController } from '../lib/use-move-conflict.controller';

/** 다른 객실타입으로 옮기기 (REQ-15) */
export function MoveConflictDialog({ conflict, onClose }: { conflict: Conflict; onClose: () => void }) {
  const c = useMoveConflictController(conflict, onClose);

  return (
    <Modal
      caption="S-04 다른 객실타입으로 옮기기 (REQ-15)"
      title={`충돌 #${conflict.id} · ${conflict.roomTypeName} ${formatStay(conflict.checkIn, conflict.checkOut)}`}
      onClose={onClose}
    >
      <p className="mt-2 text-sm text-slate-600">옮기면 해당 객실타입의 재고가 차감되고 예약이 확정됩니다.</p>
      <div className="mt-4 space-y-2">
        {c.loading && <p className="text-sm text-slate-500">재고를 확인하는 중…</p>}
        <ErrorText>{c.loadError}</ErrorText>
        {c.noOption && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">같은 숙박일 전체에 재고가 있는 객실타입이 없습니다.</p>}
        {c.options.map((o) => (
          <label key={o.roomTypeId} className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2">
              <input type="radio" name="target" checked={c.target === o.roomTypeId} onChange={() => c.setTarget(o.roomTypeId)} />
              {o.name} <span className="text-xs text-slate-400">{o.code}</span>
            </span>
            <span className="text-xs text-slate-500">남은 재고 최소 {o.minAvailable}</span>
          </label>
        ))}
      </div>
      <ErrorText>{c.error}</ErrorText>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={buttonClass.secondary} onClick={onClose}>
          닫기
        </button>
        <button type="button" className={buttonClass.primary} disabled={!c.canSubmit} onClick={c.submit}>
          옮기고 확정
        </button>
      </div>
    </Modal>
  );
}
