import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { clientFetch, endpoints, errorMessage, type RoomType, type SimulationRequest, type SimulationRun } from '@/shared/api';
import { addDays, isDateString } from '@/shared/lib';

interface Params {
  roomTypes: RoomType[];
  defaultCheckIn: string;
  onDone: (run: SimulationRun) => void;
}

/** "마지막 1실" 실행 조건과 실행 (REQ-19). 기본값은 시연 시나리오(남은 1실, 50건, 통보형 40%, 중복 10%)다 */
export function useRunSimulationController({ roomTypes, defaultCheckIn, onDone }: Params) {
  const router = useRouter();
  const [form, setForm] = useState({
    roomTypeId: roomTypes.at(-1)?.id ?? 1,
    checkIn: defaultCheckIn,
    checkOut: addDays(defaultCheckIn, 1),
    prepareRemaining: '1',
    requestCount: 50,
    notifyRatio: 40,
    duplicateRatio: 10,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const datesValid = isDateString(form.checkIn) && isDateString(form.checkOut) && form.checkOut > form.checkIn;

  const mutation = useMutation({
    mutationFn: (body: SimulationRequest) => clientFetch(endpoints.simulationRun, { input: body }),
    onSuccess: (run) => {
      onDone(run);
      router.refresh(); // 이전 실행 목록을 서버가 다시 그린다
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!datesValid) return;
    mutation.mutate({
      roomTypeId: form.roomTypeId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      prepareRemaining: form.prepareRemaining === '' ? undefined : Number(form.prepareRemaining),
      requestCount: form.requestCount,
      notifyRatio: form.notifyRatio,
      duplicateRatio: form.duplicateRatio,
    });
  }

  return {
    form,
    set,
    setRequestCount: (raw: string) => set('requestCount', Math.min(100, Math.max(1, Number(raw) || 1))),
    datesValid,
    pending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
    submit,
  };
}
