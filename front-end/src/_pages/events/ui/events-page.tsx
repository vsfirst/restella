import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import type { SearchParams } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { EventLogTable } from '@/widgets/event-log-table';
import { parseEventParams } from '../lib/search-params';

/** S-05 이벤트 로그 */
export function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const { type, cursor } = parseEventParams(await searchParams);
  const [roomTypes, page] = await Promise.all([serverFetch(endpoints.roomTypeList),
    serverFetch(endpoints.eventList, { params: { type: type ? [type] : undefined, cursor } }),
  ]);
  return <EventLogTable type={type} cursor={cursor} page={page} roomTypes={roomTypes} />;
}
