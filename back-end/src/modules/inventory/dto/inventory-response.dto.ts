export class InventoryDayResponseDto {
  /** 숙박일 (YYYY-MM-DD) */
  stayDate: string;

  /** 총 재고. 재고를 등록하지 않은 날짜는 null이고 판매하지 않는다 */
  total: number | null;

  sold: number | null;

  available: number | null;
}

export class InventoryCalendarResponseDto {
  roomTypeId: number;
  code: string;
  name: string;
  days: InventoryDayResponseDto[];
}

export class AdjustInventoryResponseDto {
  roomTypeId: number;

  /** 숙박일 (YYYY-MM-DD) */
  stayDate: string;

  totalRooms: number;
  soldRooms: number;
  available: number;

  /** 채널 동기화 순서를 정하는 재고 버전 */
  revision: number;
}
