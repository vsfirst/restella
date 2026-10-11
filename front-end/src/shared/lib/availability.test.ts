import { describe, expect, it } from 'vitest';
import type { InventoryRow } from '../api/types';
import { availabilityTone, roomTypesWithStock } from './availability';

const day = (stayDate: string, available: number | null) => ({
  stayDate,
  total: available === null ? null : 4,
  sold: available === null ? null : 4 - available,
  available,
});
const row = (roomTypeId: number, days: ReturnType<typeof day>[]): InventoryRow => ({ roomTypeId, code: `RT${roomTypeId}`, name: `객실${roomTypeId}`, days });

describe('availability', () => {
  it('칸 색: 매진, 1실 남음, 여유, 미등록', () => {
    expect(availabilityTone(day('2026-10-10', 0))).toBe('soldOut');
    expect(availabilityTone(day('2026-10-10', 1))).toBe('last');
    expect(availabilityTone(day('2026-10-10', 3))).toBe('open');
    expect(availabilityTone(day('2026-10-10', null))).toBe('unregistered');
  });

  it('옮길 수 있는 객실타입은 모든 숙박일에 재고가 있어야 한다 (REQ-15)', () => {
    const rows = [
      row(1, [day('2026-10-10', 2), day('2026-10-11', 1)]),
      row(2, [day('2026-10-10', 2), day('2026-10-11', 0)]),
      row(3, [day('2026-10-10', 0), day('2026-10-11', 0)]),
    ];
    expect(roomTypesWithStock(rows, ['2026-10-10', '2026-10-11'], 3).map((r) => r.roomTypeId)).toEqual([1]);
  });
});
