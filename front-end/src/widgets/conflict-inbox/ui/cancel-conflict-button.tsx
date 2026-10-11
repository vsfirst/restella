'use client';

import type { Conflict } from '@/shared/api';
import { buttonClass } from '@/shared/ui';
import { useCancelConflictController } from '../lib/use-cancel-conflict.controller';

/** 취소로 처리 (AC-14-1) */
export function CancelConflictButton({ conflict }: { conflict: Conflict }) {
  const c = useCancelConflictController(conflict);
  return (
    <button type="button" className={buttonClass.smallDanger} disabled={c.pending} title={c.title} onClick={c.cancel}>
      {c.pending ? '취소 중…' : c.failed ? '다시 시도' : '취소'}
    </button>
  );
}
