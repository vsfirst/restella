import { MariaDbContainer, type StartedMariaDbContainer } from '@testcontainers/mariadb';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';
import { dataSourceOptions } from '../../src/config/typeorm.config.js';

// 실제 MariaDB(운영과 같은 12.3 LTS)를 한 번 띄우고 마이그레이션을 적용한다.
// 잠금·유일키·CHECK 제약 동작은 DB마다 달라서 모의 객체로는 검증할 수 없다 (ADR-0004)
export const MARIADB_IMAGE = 'mariadb:12.3.3';

export interface TestDb {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    db: TestDb;
  }
}

let container: StartedMariaDbContainer | undefined;

export default async function setup(project: TestProject) {
  container = await new MariaDbContainer(MARIADB_IMAGE)
    .withDatabase('restella')
    .withUsername('restella')
    .withUserPassword('restella-test-only')
    .withCommand(['--max-connections=500'])
    .start();

  const db: TestDb = {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getUserPassword(),
    database: container.getDatabase(),
  };

  const ds = new DataSource(
    dataSourceOptions({ DB_HOST: db.host, DB_PORT: db.port, DB_USER: db.user, DB_PASSWORD: db.password, DB_NAME: db.database }),
  );
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();

  project.provide('db', db);

  return async () => {
    await container?.stop();
  };
}
