import { firstParam, isDateString } from '@/shared/lib';

type Params = Record<string, string | string[] | undefined>;

/** ?from=YYYY-MM-DD. 없거나 틀리면 오늘부터 */
export function parseInventoryParams(sp: Params, today: string) {
  const from = firstParam(sp.from);
  return { from: isDateString(from) ? from : today };
}
