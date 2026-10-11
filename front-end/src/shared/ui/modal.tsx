'use client';

import type { ReactNode } from 'react';
import { useEscape } from '../lib/use-escape';

interface Props {
  title: ReactNode;
  caption?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** 가운데 대화상자. Esc나 바깥을 누르면 닫힌다 */
export function Modal({ title, caption, onClose, children }: Props) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {caption && <p className="text-[11px] text-slate-400">{caption}</p>}
            <h2 className="mt-1 text-base font-semibold">{title}</h2>
          </div>
          <button type="button" aria-label="닫기" className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 오른쪽에서 열리는 상세 패널 */
export function Drawer({ title, caption, onClose, children }: Props) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        className="h-full w-full max-w-[440px] overflow-y-auto bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {caption && <p className="text-[11px] text-slate-400">{caption}</p>}
            <h2 className="mt-1 text-base font-semibold">{title}</h2>
          </div>
          <button type="button" aria-label="닫기" className="text-slate-400 hover:text-slate-600" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
