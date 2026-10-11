export class OperatorSummaryResponseDto {
  id: number;
  name: string;
}

export class LoginResponseDto {
  /** back-end 호출용 액세스 토큰. front-end 서버의 암호화 쿠키에만 보관한다 */
  accessToken: string;

  /** 토큰 만료 시각 (ISO 8601) */
  expiresAt: string;

  operator: OperatorSummaryResponseDto;
}
