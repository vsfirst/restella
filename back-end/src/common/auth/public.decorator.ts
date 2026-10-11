import { SetMetadata } from '@nestjs/common';

// 운영자 토큰 검사를 건너뛴다. 채널 API, 내부 수신, 로그인, 상태 확인처럼 다른 방식으로 보호하는 경로에만 쓴다.
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
