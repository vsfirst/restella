import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { clientFetch, type Conflict, endpoints, errorMessage } from '@/shared/api';
import { addDays, enumerateDates, roomTypesWithStock } from '@/shared/lib';
import { useConflictMutation } from './use-conflict-mutation';

/** 다른 객실타입으로 옮기기 (REQ-15). 모든 숙박일에 재고가 있는 객실타입만 고를 수 있다 */
export function useMoveConflictController(conflict: Conflict, onClose: () => void) {
  const lastNight = addDays(conflict.checkOut, -1);
  const nights = enumerateDates(conflict.checkIn, lastNight);
  // 대화상자를 연 뒤에 필요한 데이터라 브라우저에서 바로 조회한다
  const calendar = useQuery({
    queryKey: ['inventory', conflict.checkIn, lastNight],
    queryFn: ({ signal }) => clientFetch(endpoints.inventoryCalendar, { params: { from: conflict.checkIn, to: lastNight }, signal }),
  });
  const [target, setTarget] = useState<number | null>(null);
  const mutation = useConflictMutation(
    (id) => clientFetch(endpoints.conflictMove, { path: [id], input: { roomTypeId: target! } }),
    onClose,
  );

  const options = (calendar.data ? roomTypesWithStock(calendar.data, nights, conflict.roomTypeId) : []).map((row) => ({
    roomTypeId: row.roomTypeId,
    name: row.name,
    code: row.code,
    minAvailable: Math.min(...nights.map((n) => row.days.find((d) => d.stayDate === n)?.available ?? 0)),
  }));

  return {
    loading: calendar.isPending,
    loadError: calendar.error ? errorMessage(calendar.error) : null,
    noOption: Boolean(calendar.data) && options.length === 0,
    options,
    target,
    setTarget,
    canSubmit: target !== null && !mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
    submit: () => mutation.mutate(conflict.id),
  };
}
