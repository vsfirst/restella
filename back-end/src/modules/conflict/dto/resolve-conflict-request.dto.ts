import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ResolveConflictRequestDto {
  /** 숙소 밖에서 어떻게 해결했는지 (AC-14-2) */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500, { message: '메모는 1~500자로 필수다' })
  note: string;
}
