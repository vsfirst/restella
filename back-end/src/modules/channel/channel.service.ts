import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { type Env, parseChannelSecrets } from '../../config/env.validation.js';
import { Channel } from './channel.entity.js';

@Injectable()
export class ChannelService {
  private readonly secrets: Map<string, string>;

  constructor(
    @InjectRepository(Channel) private readonly repo: Repository<Channel>,
    config: ConfigService<Env, true>,
  ) {
    this.secrets = parseChannelSecrets(config.get('CHANNEL_SECRETS_JSON', { infer: true }));
  }

  list(): Promise<Channel[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  findActiveByCode(code: string): Promise<Channel | null> {
    return this.repo.findOneBy({ code, active: true });
  }

  /** 웹훅 서명 검증용 비밀키. DB가 아니라 환경변수(Secrets Manager)에서 온다 */
  secretFor(code: string): string | undefined {
    return this.secrets.get(code);
  }
}
