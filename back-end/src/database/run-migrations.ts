import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.validation.js';
import { dataSourceOptions } from '../config/typeorm.config.js';

// 배포 시 앱보다 먼저 한 번 실행한다 (Argo CD PreSync Job). 사용: pnpm build && pnpm migration:run
const env = validateEnv(process.env);
const dataSource = new DataSource(dataSourceOptions(env));
await dataSource.initialize();
try {
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(`마이그레이션 ${applied.length}개 적용: ${applied.map((m) => m.name).join(', ') || '없음'}`);
} finally {
  await dataSource.destroy();
}
