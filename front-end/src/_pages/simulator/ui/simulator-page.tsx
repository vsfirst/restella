import { connection } from 'next/server';
import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import { todayInSeoul } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { SimulationConsole } from '@/widgets/simulation-console';

/** S-06 동시 예약 시뮬레이터 */
export function SimulatorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // 오늘 날짜와 실행 기록은 요청 시점 값이다
  const [roomTypes, runs] = await Promise.all([serverFetch(endpoints.roomTypeList), serverFetch(endpoints.simulationList, { params: { limit: 10 } })]);
  return <SimulationConsole today={todayInSeoul()} roomTypes={roomTypes} runs={runs} />;
}
