import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/** 충돌 처리 요청. 성공하면 서버가 충돌·예약·재고를 다시 그린다 */
export function useConflictMutation<T>(request: (conflictId: number) => Promise<T>, onDone?: () => void) {
  const router = useRouter();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      onDone?.();
      router.refresh();
    },
  });
}
