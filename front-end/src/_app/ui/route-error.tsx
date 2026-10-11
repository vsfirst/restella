'use client';

import { buttonClass } from '@/shared/ui';
import { useRouteErrorController } from '../lib/use-route-error.controller';

/** 화면을 그리다 실패했을 때 (back-end 장애 등) */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { message } = useRouteErrorController(error);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center">
      <p className="font-semibold text-rose-700">화면을 불러오지 못했습니다</p>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <button type="button" onClick={reset} className={`mt-4 ${buttonClass.secondary}`}>
        다시 시도
      </button>
    </div>
  );
}
