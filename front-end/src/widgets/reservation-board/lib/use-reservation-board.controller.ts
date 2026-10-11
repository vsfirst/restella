import { usePathname, useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { type ReservationFilters, toSearch } from '@/shared/api';

/** 예약 목록 (REQ-16). 필터·페이지·선택한 예약은 URL에 두고, 바뀌면 서버가 다시 그린다 */
export function useReservationBoardController(filters: ReservationFilters, cursor: number | undefined, nextCursor: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const href = (extra: { id?: number; cursor?: string | null }) => `${pathname}${toSearch({ ...filters, cursor, ...extra })}`;

  function applyFilters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => (f.get(k) as string) || undefined;
    router.push(`${pathname}${toSearch({ channelId: get('channelId'), status: get('status'), from: get('from'), to: get('to') })}`);
  }

  return {
    applyFilters,
    openDetail: (id: number) => router.push(href({ id }), { scroll: false }),
    closeDetail: () => router.push(href({}), { scroll: false }),
    nextPageHref: nextCursor ? href({ cursor: nextCursor }) : null,
    firstPageHref: cursor ? href({ cursor: null }) : null,
  };
}
