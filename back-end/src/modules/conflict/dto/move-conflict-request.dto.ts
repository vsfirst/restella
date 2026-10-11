import { IsInt, Min } from 'class-validator';

export class MoveConflictRequestDto {
  /** 옮길 객실타입. 같은 숙박일 전체에 재고가 있어야 한다 */
  @IsInt()
  @Min(1)
  roomTypeId: number;
}
