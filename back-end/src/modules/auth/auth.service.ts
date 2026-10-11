import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import type { Env } from '../../config/env.validation.js';
import { Operator } from './operator.entity.js';
import { problem } from '../../common/http/problem.js';

@Injectable()
export class AuthService {
  private readonly ttlSeconds: number;
  // 계정이 없을 때도 같은 시간이 걸리도록 검증에 쓰는 더미 해시 (응답 시간으로 아이디 존재 여부를 알 수 없게 한다)
  private readonly dummyHash = argon2.hash(randomBytes(32).toString('hex'));

  constructor(
    @InjectRepository(Operator) private readonly operators: Repository<Operator>,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('JWT_TTL_SECONDS', { infer: true });
  }

  /** 운영자 로그인 (REQ-18). 실패 사유(아이디/비밀번호)는 구분하지 않는다 */
  async login(loginId: string, password: string) {
    const operator = await this.operators.findOneBy({ loginId });
    const ok = await argon2.verify(operator?.passwordHash ?? (await this.dummyHash), password).catch(() => false);
    if (!operator || !ok) throw problem('invalid-credentials');

    const accessToken = await this.jwt.signAsync(
      { sub: String(operator.id), name: operator.name },
      { expiresIn: this.ttlSeconds },
    );
    return {
      accessToken,
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000).toISOString(),
      operator: { id: operator.id, name: operator.name },
    };
  }
}
