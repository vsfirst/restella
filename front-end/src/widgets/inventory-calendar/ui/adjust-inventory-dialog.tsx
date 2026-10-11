'use client';

import type { InventoryDay } from '@/shared/api';
import { monthDayWithWeekday } from '@/shared/lib';
import { buttonClass, ErrorText, inputClass, Modal } from '@/shared/ui';
import { useAdjustInventoryController } from '../lib/use-adjust-inventory.controller';

interface Props {
  roomType: { roomTypeId: number; name: string };
  day: InventoryDay & { total: number; sold: number };
  onClose: () => void;
}

/** 총 재고 조정 (S-02a, REQ-03) */
export function AdjustInventoryDialog({ roomType, day, onClose }: Props) {
  const c = useAdjustInventoryController({ roomTypeId: roomType.roomTypeId, day, onClose });

  return (
    <Modal caption="S-02a 총 재고 조정 (REQ-03)" title={`${roomType.name} · ${monthDayWithWeekday(day.stayDate)}`} onClose={onClose}>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <Stat label="판매 수" value={day.sold} />
        <Stat label="현재 총 재고" value={day.total} />
        <Stat label="남은 재고" value={c.remaining} />
      </dl>
      <form onSubmit={c.submit}>
        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="totalRooms">
          새 총 재고
        </label>
        <input
          id="totalRooms"
          type="number"
          min={day.sold}
          max={1000}
          value={c.value}
          onChange={(e) => c.setValue(e.target.value)}
          className={`mt-1.5 ${inputClass}`}
          autoFocus
        />
        <p className="mt-1.5 text-xs text-slate-500">판매 수({day.sold})보다 작게 줄일 수 없습니다.</p>
        <p className="mt-4 rounded-md bg-sky-50 p-3 text-xs text-sky-800">저장하면 바뀐 남은 재고가 모든 채널에 전송됩니다 (REQ-11).</p>
        <ErrorText>{c.error}</ErrorText>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={buttonClass.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={buttonClass.primary} disabled={!c.canSave}>
            {c.pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
