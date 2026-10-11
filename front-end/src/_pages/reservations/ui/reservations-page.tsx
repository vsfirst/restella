import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import type { SearchParams } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { ReservationBoard } from '@/widgets/reservation-board';
import { parseReservationParams } from '../lib/search-params';

/** S-03 예약 목록과 S-03a 상세. 필터·페이지·선택한 예약은 URL에서 읽어 서버에서 받는다 */
export function ReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const { filters, cursor, selectedId } = parseReservationParams(await searchParams);
  const [channels, page, selected] = await Promise.all([
    serverFetch(endpoints.channelList),
    serverFetch(endpoints.reservationList, { params: { ...filters, cursor } }),
    selectedId !== undefined ? serverFetch(endpoints.reservationDetail, { path: [selectedId] }) : undefined,
  ]);
  return <ReservationBoard filters={filters} cursor={cursor} page={page} channels={channels} selected={selected} />;
}
