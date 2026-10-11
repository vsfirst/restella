import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/auth/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginRequestDto } from './dto/login-request.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 같은 IP에서 1분에 5회까지 (docs/2-design/api.md) */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.auth.login(body.loginId, body.password);
  }
}
