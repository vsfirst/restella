import { useState } from 'react';
import type { Conflict, ConflictList, ConflictStatus } from '@/shared/api';

type Dialog = { kind: 'resolve' | 'move'; conflict: Conflict } | null;

/** 충돌 처리함 (REQ-13~15): 새로 들어온 충돌 강조, 처리 대화상자 */
export function useConflictInboxController(status: ConflictStatus, list: ConflictList) {
  // 화면을 연 뒤에 실시간으로 들어온 충돌(서버가 다시 그린 목록에 새로 생긴 것)을 강조한다
  const [initialIds] = useState(() => new Set(list.items.map((c) => c.id)));
  const [dialog, setDialog] = useState<Dialog>(null);

  return {
    isOpenTab: status === 'OPEN',
    isFresh: (id: number) => !initialIds.has(id),
    dialog,
    openResolve: (conflict: Conflict) => setDialog({ kind: 'resolve', conflict }),
    openMove: (conflict: Conflict) => setDialog({ kind: 'move', conflict }),
    closeDialog: () => setDialog(null),
  };
}
