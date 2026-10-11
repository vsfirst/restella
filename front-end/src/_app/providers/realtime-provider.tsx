'use client';

import type { ReactNode } from 'react';
import { ConflictToast } from '@/widgets/conflict-toast';
import { useRealtimeController } from '../lib/use-realtime.controller';

/** 실시간 갱신과 새 충돌 알림. 콘솔의 모든 화면을 감싼다 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { newConflicts, showToast, dismissToast } = useRealtimeController();
  return (
    <>
      {children}
      {showToast && <ConflictToast count={newConflicts} onClose={dismissToast} />}
    </>
  );
}
