import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { readSession, serverFetch } from '@/shared/api/index.server';
import { ConsoleHeader, ConsoleHeaderSkeleton } from '@/widgets/console-header';
import { QueryProvider } from '../providers/query-provider';
import { RealtimeProvider } from '../providers/realtime-provider';

/** 로그인한 운영자의 콘솔 틀. 세션은 요청 시점 데이터라 <Suspense> 안에서 읽는다 */
export function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <RealtimeProvider>
        <Suspense fallback={<ConsoleHeaderSkeleton />}>
          <Header />
        </Suspense>
        <main className="mx-auto max-w-7xl px-6 py-5">{children}</main>
      </RealtimeProvider>
    </QueryProvider>
  );
}

/** 운영자 이름과 미처리 충돌 수(배지)를 서버에서 받아 그린다 */
async function Header() {
  const session = await readSession();
  if (!session) redirect('/login');
  const { openCount } = await serverFetch(endpoints.conflictList, { params: { status: 'OPEN' } });
  return <ConsoleHeader operatorName={session.operator.name} openConflicts={openCount} />;
}
