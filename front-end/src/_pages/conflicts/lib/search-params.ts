import type { ConflictStatus } from '@/shared/api';
import { CONFLICT_STATUS_LABEL, firstParam } from '@/shared/lib';

type Params = Record<string, string | string[] | undefined>;

/** ?status. 없거나 틀리면 미처리(OPEN) */
export function parseConflictParams(sp: Params): { status: ConflictStatus } {
  const status = firstParam(sp.status);
  return { status: status && status in CONFLICT_STATUS_LABEL ? (status as ConflictStatus) : 'OPEN' };
}
