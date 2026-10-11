import { connection } from 'next/server';
import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import { addDays, type SearchParams, todayInSeoul } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { ChannelSyncBoard, SYNC_BOARD_DAYS } from '@/widgets/channel-sync-board';
import { parseChannelParams } from '../lib/search-params';

/** S-07 채널별 재고 */
export function ChannelsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  await connection(); // 오늘 날짜는 요청 시점 값이다
  const roomTypes = await serverFetch(endpoints.roomTypeList);
  const { from, roomTypeId } = parseChannelParams(
    sp,
    todayInSeoul(),
    roomTypes.map((r) => r.id),
  );
  const to = addDays(from, SYNC_BOARD_DAYS - 1);
  const [channels, availability, calendar, faults] = await Promise.all([
    serverFetch(endpoints.channelList),
    serverFetch(endpoints.channelAvailability, { params: { roomTypeId, from, to } }),
    serverFetch(endpoints.inventoryCalendar, { params: { from, to } }),
    serverFetch(endpoints.channelFaults),
  ]);
  return (
    <ChannelSyncBoard
      roomTypeId={roomTypeId}
      from={from}
      roomTypes={roomTypes}
      channels={channels}
      availability={availability}
      calendar={calendar}
      faults={faults}
    />
  );
}
