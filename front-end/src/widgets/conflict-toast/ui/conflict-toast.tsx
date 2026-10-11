'use client';

import Link from 'next/link';

/** 새 충돌 알림 (AC-13-2). 어느 화면에 있든 뜨고, 누르면 충돌 처리함으로 간다 */
export function ConflictToast({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div role="status" className="fixed bottom-6 right-6 z-50 w-80 rounded-lg border border-rose-200 bg-white p-4 shadow-lg ring-1 ring-rose-100">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">새 오버부킹 충돌 {count}건</p>
          <p className="mt-1 text-sm text-slate-600">매진된 날짜에 통보형 채널(OTA)이 예약을 확정했습니다. 손님에게 미리 연락하세요.</p>
          <Link href="/conflicts" onClick={onClose} className="mt-2 inline-block text-sm font-medium text-rose-700">
            충돌 처리함 열기 →
          </Link>
        </div>
        <button type="button" aria-label="알림 닫기" className="text-slate-400 hover:text-slate-600" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
