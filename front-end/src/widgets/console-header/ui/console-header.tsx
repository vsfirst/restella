'use client';

import Link from 'next/link';
import { NAV_ITEMS } from '@/shared/config';
import { cn } from '@/shared/lib';
import { useConsoleHeaderController } from '../lib/use-console-header.controller';
import { LogoutButton } from './logout-button';

/** 콘솔 공통 틀: 메뉴, 미처리 충돌 배지(REQ-13), 운영자, 로그아웃. 충돌 수는 서버가 넘기고 실시간 알림이 오면 다시 그린다 */
export function ConsoleHeader({ operatorName, openConflicts: open }: { operatorName: string; openConflicts: number }) {
  const { isActive } = useConsoleHeaderController();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Link href="/inventory" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Restella</span>
          <span className="text-xs text-slate-500">운영자 콘솔</span>
        </Link>
        <nav className="flex gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-md px-3 py-2 text-sm font-medium',
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {label}
                {href === '/conflicts' && open > 0 && (
                  <span data-testid="conflict-badge" className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {open}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {open > 0 && (
            <Link href="/conflicts" className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              미처리 충돌 {open}건
            </Link>
          )}
          <span className="text-slate-500">{operatorName}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

export function ConsoleHeaderSkeleton() {
  return <div className="h-14 border-b border-slate-200 bg-white" />;
}
