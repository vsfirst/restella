import type { ReservationFilters, ReservationStatus } from '@/shared/api';
import { firstParam, intParam, isDateString, RESERVATION_STATUS_LABEL } from '@/shared/lib';

type Params = Record<string, string | string[] | undefined>;

/** ?channelId&status&from&to&cursor&id. 형식이 틀린 값은 버린다 */
export function parseReservationParams(sp: Params): { filters: ReservationFilters; cursor?: number; selectedId?: number } {
  const status = firstParam(sp.status);
  const from = firstParam(sp.from);
  const to = firstParam(sp.to);
  return {
    filters: {
      channelId: intParam(sp.channelId),
      status: status && status in RESERVATION_STATUS_LABEL ? (status as ReservationStatus) : undefined,
      from: isDateString(from) ? from : undefined,
      to: isDateString(to) ? to : undefined,
    },
    cursor: intParam(sp.cursor),
    selectedId: intParam(sp.id),
  };
}
