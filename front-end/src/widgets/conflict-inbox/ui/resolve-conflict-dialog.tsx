'use client';

import type { Conflict } from '@/shared/api';
import { formatStay } from '@/shared/lib';
import { buttonClass, ErrorText, inputClass, Modal } from '@/shared/ui';
import { useResolveConflictController } from '../lib/use-resolve-conflict.controller';

/** 해결됨 처리 (REQ-14 AC-14-2). 숙소 밖에서 해결한 경우다 */
export function ResolveConflictDialog({ conflict, onClose }: { conflict: Conflict; onClose: () => void }) {
  const c = useResolveConflictController(conflict, onClose);

  return (
    <Modal
      caption="S-04 해결됨 처리 (REQ-14)"
      title={`충돌 #${conflict.id} · ${conflict.channelName} · ${conflict.roomTypeName} ${formatStay(conflict.checkIn, conflict.checkOut)}`}
      onClose={onClose}
    >
      <p className="mt-2 text-sm text-slate-600">숙소 밖에서 해결한 경우에 씁니다. 예약은 충돌 상태로 남고 처리 기록만 남습니다.</p>
      <form onSubmit={c.submit}>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="note">
          메모 <span className="text-rose-600">(필수)</span>
        </label>
        <textarea
          id="note"
          rows={3}
          maxLength={500}
          value={c.note}
          onChange={(e) => c.setNote(e.target.value)}
          placeholder="예: 손님과 통화. 인근 제휴 숙소 같은 등급 객실로 안내"
          className={`mt-1.5 ${inputClass}`}
          autoFocus
        />
        <ErrorText>{c.error}</ErrorText>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={buttonClass.secondary} onClick={onClose}>
            닫기
          </button>
          <button type="submit" className={buttonClass.primary} disabled={!c.canSubmit}>
            해결됨으로 처리
          </button>
        </div>
      </form>
    </Modal>
  );
}
