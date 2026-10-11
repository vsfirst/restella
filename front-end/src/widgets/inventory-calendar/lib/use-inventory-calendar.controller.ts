import { useState } from 'react';
import type { InventoryDay, InventoryRow } from '@/shared/api';
import { CALENDAR_DAYS } from '@/shared/config';
import { addDays, enumerateDates } from '@/shared/lib';

type EditableDay = InventoryDay & { total: number; sold: number };

/** 재고 달력 (REQ-02): 기간 이동 링크와 총 재고 조정 대상 선택 */
export function useInventoryCalendarController(from: string, today: string) {
  const to = addDays(from, CALENDAR_DAYS - 1);
  const [selected, setSelected] = useState<{ row: InventoryRow; day: EditableDay } | null>(null);

  return {
    to,
    dates: enumerateDates(from, to),
    links: { prev: `?from=${addDays(from, -7)}`, next: `?from=${addDays(from, 7)}`, today: `?from=${today}` },
    selected,
    /** 재고가 등록된 칸만 조정할 수 있다 */
    select: (row: InventoryRow, day: InventoryDay) => {
      if (day.total !== null && day.sold !== null) setSelected({ row, day: { ...day, total: day.total, sold: day.sold } });
    },
    closeDialog: () => setSelected(null),
  };
}
