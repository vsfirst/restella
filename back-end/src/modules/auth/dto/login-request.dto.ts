import { IsString, Length } from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @Length(1, 64)
  loginId: string;

  @IsString()
  @Length(1, 128)
  password: string;
}
