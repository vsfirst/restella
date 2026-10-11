import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from '../../config/env.validation.js';
import { dataSourceOptions } from '../../config/typeorm.config.js';
import { seedDemoData } from './seed.js';

// 사용: pnpm build && SEED_OPERATOR_PASSWORD=... pnpm seed
// 운영자 비밀번호는 Git에 두지 않고 실행할 때 환경변수로만 받는다
const env = validateEnv(process.env);
const ds = new DataSource(dataSourceOptions(env));
await ds.initialize();
try {
  await seedDemoData(ds, {
    simulatorBaseUrl: env.SIMULATOR_TARGET_URL,
    operatorPassword: process.env.SEED_OPERATOR_PASSWORD,
  });
  console.log('시드 완료');
} finally {
  await ds.destroy();
}
