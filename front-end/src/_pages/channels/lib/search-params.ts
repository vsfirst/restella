import { firstParam, intParam, isDateString } from '@/shared/lib';

type Params = Record<string, string | string[] | undefined>;

/** ?roomTypeId&from. 객실타입이 없거나 모르는 값이면 마지막 객실타입(시연용 패밀리 스위트) */
export function parseChannelParams(sp: Params, today: string, roomTypeIds: number[]) {
  const from = firstParam(sp.from);
  const requested = intParam(sp.roomTypeId);
  return {
    from: isDateString(from) ? from : today,
    roomTypeId: requested !== undefined && roomTypeIds.includes(requested) ? requested : (roomTypeIds.at(-1) ?? 1),
  };
}
