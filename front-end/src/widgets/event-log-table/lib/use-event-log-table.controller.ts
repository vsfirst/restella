import { type EventPage, type EventType, type RoomType, toSearch } from '@/shared/api';
import { describeEvent } from '@/shared/lib';

/** 이벤트 로그 (REQ-17): 운영자가 읽을 문장과 페이지 이동 링크 */
export function useEventLogTableController(page: EventPage, roomTypes: RoomType[], type?: EventType, cursor?: number) {
  const codeOf = (id: number) => roomTypes.find((r) => r.id === id)?.code;
  return {
    events: page.items.map((e) => ({ ...e, text: describeEvent(e, codeOf) })),
    nextPageHref: page.nextCursor ? `/events${toSearch({ type, cursor: page.nextCursor })}` : null,
    firstPageHref: cursor ? `/events${toSearch({ type })}` : null,
  };
}
