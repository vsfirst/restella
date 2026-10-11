import { clientFetch, type Conflict, endpoints, errorMessage } from '@/shared/api';
import { useConflictMutation } from './use-conflict-mutation';

/** 취소로 처리 (AC-14-1). 예약을 취소하고 채널에 취소를 알린다 */
export function useCancelConflictController(conflict: Conflict) {
  const mutation = useConflictMutation((id) => clientFetch(endpoints.conflictCancel, { path: [id] }));
  return {
    pending: mutation.isPending,
    failed: mutation.isError,
    title: mutation.error ? errorMessage(mutation.error) : '예약을 취소하고 채널에 알립니다',
    cancel: () => {
      if (window.confirm(`${conflict.channelName} 예약 ${conflict.channelReservationNo}를 취소하고 채널에 알릴까요?`)) mutation.mutate(conflict.id);
    },
  };
}
