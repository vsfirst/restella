import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { clientFetch, endpoints, errorMessage } from '@/shared/api';

interface Params {
  roomTypeId: number;
  day: { stayDate: string; total: number; sold: number };
  onClose: () => void;
}

/** 총 재고 조정 (REQ-03). 판매 수보다 작게 줄일 수 없다 (AC-03-2) */
export function useAdjustInventoryController({ roomTypeId, day, onClose }: Params) {
  const router = useRouter();
  const [value, setValue] = useState(String(day.total));
  const total = Number(value);
  const valid = value !== '' && Number.isInteger(total) && total >= day.sold && total <= 1000;

  const mutation = useMutation({
    mutationFn: () =>
      clientFetch(endpoints.inventoryAdjust, { path: [roomTypeId, day.stayDate], input: { totalRooms: total } }),
    onSuccess: () => {
      onClose();
      router.refresh(); // 서버가 바뀐 재고로 화면을 다시 그린다
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) mutation.mutate();
  }

  return {
    value,
    setValue,
    /** 남은 재고 미리보기: '3 → 2' */
    remaining: valid ? `${day.total - day.sold} → ${total - day.sold}` : String(day.total - day.sold),
    canSave: valid && total !== day.total && !mutation.isPending,
    pending: mutation.isPending,
    error: mutation.error ? errorMessage(mutation.error) : null,
    submit,
  };
}
