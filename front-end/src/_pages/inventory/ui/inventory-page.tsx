import { connection } from 'next/server';
import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import { CALENDAR_DAYS } from '@/shared/config';
import { addDays, type SearchParams, todayInSeoul } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { InventoryCalendar } from '@/widgets/inventory-calendar';
import { parseInventoryParams } from '../lib/search-params';

/** S-02 재고 달력. 재고는 서버에서 받아 그린다 */
export function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  await connection(); // 오늘 날짜는 요청 시점 값이다
  const today = todayInSeoul();
  const { from } = parseInventoryParams(sp, today);
  const rows = await serverFetch(endpoints.inventoryCalendar, { params: { from, to: addDays(from, CALENDAR_DAYS - 1) } });
  return <InventoryCalendar from={from} today={today} rows={rows} />;
}
