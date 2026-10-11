import type { EventType } from '@/shared/api';
import { EVENT_TYPE_LABEL, firstParam, intParam } from '@/shared/lib';

type Params = Record<string, string | string[] | undefined>;

/** ?type&cursor. 유형이 없거나 틀리면 전체 */
export function parseEventParams(sp: Params): { type?: EventType; cursor?: number } {
  const type = firstParam(sp.type);
  return { type: type && type in EVENT_TYPE_LABEL ? (type as EventType) : undefined, cursor: intParam(sp.cursor) };
}
