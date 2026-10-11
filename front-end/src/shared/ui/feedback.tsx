import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-xs text-rose-600">
      {children}
    </p>
  );
}

/** 서버에서 데이터를 받는 동안 보이는 자리 표시 */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="animate-pulse">
      <div className="h-7 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-80 rounded bg-slate-100" />
      <div className="mt-6 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-8 rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function TableCard({ children }: { children: ReactNode }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">{children}</div>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}
