import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ChannelFaults, clientFetch, endpoints, errorMessage } from '@/shared/api';

/** 고를 수 있는 실패율 */
export const FAILURE_RATES = [0, 0.3, 0.5, 1];

/** 가짜 채널 장애 주입 (재시도 시연용, REQ-12). 현재 설정은 서버가 props로 넘긴다 */
export function useChannelFaultsController(faults: ChannelFaults) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: (next: ChannelFaults) => clientFetch(endpoints.channelFaultsUpdate, { input: { faults: next } }),
    onSuccess: () => router.refresh(),
  });

  function setRate(code: string, failureRate: number) {
    const next = { ...faults };
    if (failureRate === 0) delete next[code];
    else next[code] = { failureRate, delayMs: next[code]?.delayMs ?? 0 };
    mutation.mutate(next);
  }

  return {
    // 저장 중에는 고른 값을 먼저 보여준다
    rateOf: (code: string) => (mutation.isPending ? mutation.variables?.[code]?.failureRate : faults[code]?.failureRate) ?? 0,
    setRate,
    pending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
  };
}
