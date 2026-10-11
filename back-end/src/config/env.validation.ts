import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// 환경변수 계약. 값이 빠지거나 형식이 틀리면 앱이 뜨지 않는다.
// 비밀값(DB 비밀번호, 서명 키 등)은 운영에서 Secrets Manager → External Secrets → 환경변수로 들어온다.
export class Env {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  DB_PORT = 3306;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  // 운영자 토큰 서명 키 (HS256)
  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(60)
  @Max(86_400)
  JWT_TTL_SECONDS = 8 * 60 * 60; // AC-18-2: 8시간

  // 채널별 웹훅 서명 키: {"DIRECT":"...","OTA_A":"..."}
  @IsString()
  @IsNotEmpty()
  CHANNEL_SECRETS_JSON: string;

  // Restella가 채널로 보내는 재고 동기화 요청의 서명 키
  @IsString()
  @MinLength(32)
  OUTBOUND_SIGNING_SECRET: string;

  // 시뮬레이터가 예약을 보내는 Restella 주소 (자기 자신)
  @IsUrl({ require_tld: false, require_protocol: true })
  SIMULATOR_TARGET_URL = 'http://localhost:3000';

  // 시뮬레이터 채널별 장애 주입: {"OTA_C":{"failureRate":0.3,"delayMs":0}}
  @IsOptional()
  @IsString()
  SIMULATOR_FAULTS_JSON?: string;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw, { enableImplicitConversion: false, exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`환경변수 검증 실패\n${detail.join('\n')}`);
  }
  parseChannelSecrets(env.CHANNEL_SECRETS_JSON); // JSON 형식도 기동 시점에 확인한다
  return env;
}

export function parseChannelSecrets(json: string): Map<string, string> {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('CHANNEL_SECRETS_JSON은 {"채널코드":"비밀키"} 형식이어야 한다');
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  for (const [code, secret] of entries) {
    if (typeof secret !== 'string' || secret.length < 32) {
      throw new Error(`채널 ${code}의 비밀키는 32자 이상의 문자열이어야 한다`);
    }
  }
  return new Map(entries as [string, string][]);
}
