import { Suspense } from 'react';
import { endpoints } from '@/shared/api';
import { serverFetch } from '@/shared/api/index.server';
import type { SearchParams } from '@/shared/lib';
import { PageSkeleton } from '@/shared/ui';
import { ConflictInbox } from '@/widgets/conflict-inbox';
import { parseConflictParams } from '../lib/search-params';

/** S-04 충돌 처리함 */
export function ConflictsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const { status } = parseConflictParams(await searchParams);
  const list = await serverFetch(endpoints.conflictList, { params: { status, limit: 200 } });
  // 탭을 바꾸면 새로 강조할 기준을 다시 잡는다
  return <ConflictInbox key={status} status={status} list={list} />;
}
