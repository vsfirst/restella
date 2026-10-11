import { IsDateString, IsString, Length, Matches } from 'class-validator';

export class ReceiveReservationRequestDto {
  /** 채널이 매긴 예약번호. 같은 채널에서 같은 번호는 한 번만 처리한다 */
  @Matches(/^[A-Za-z0-9._-]{1,64}$/, { message: 'channelReservationNo는 영문·숫자·._- 1~64자다' })
  channelReservationNo: string;

  @Matches(/^[A-Z0-9-]{1,32}$/, { message: 'roomTypeCode 형식이 올바르지 않다' })
  roomTypeCode: string;

  /** 체크인 (YYYY-MM-DD) */
  @IsDateString({ strict: true })
  checkIn: string;

  /** 체크아웃 (YYYY-MM-DD). 이 날짜는 재고를 차감하지 않는다 */
  @IsDateString({ strict: true })
  checkOut: string;

  @IsString()
  @Length(1, 100)
  guestName: string;
}
