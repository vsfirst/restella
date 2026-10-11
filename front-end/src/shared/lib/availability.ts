import type { InventoryDay, InventoryRow } from '../api/types';

export type AvailabilityTone = 'unregistered' | 'soldOut' | 'last' | 'open';

/** 칸 색: 매진(빨강), 1실 남음(노랑), 여유(흰색) */
export function availabilityTone(day: Pick<InventoryDay, 'total' | 'available'>): AvailabilityTone {
  if (day.total === null || day.available === null) return 'unregistered';
  if (day.available <= 0) return 'soldOut';
  if (day.available === 1) return 'last';
  return 'open';
}

/** 숙박일 전부에 재고가 있는 객실타입만 (충돌 옮기기, REQ-15) */
export function roomTypesWithStock(rows: InventoryRow[], nights: string[], excludeRoomTypeId?: number): InventoryRow[] {
  return rows.filter(
    (row) =>
      row.roomTypeId !== excludeRoomTypeId &&
      nights.every((night) => {
        const day = row.days.find((d) => d.stayDate === night);
        return day !== undefined && day.available !== null && day.available > 0;
      }),
  );
}
