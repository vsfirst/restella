import type { DataSourceOptions } from 'typeorm';
import { Init1760000000000 } from '../database/migrations/1760000000000-init.js';
import { Operator } from '../modules/auth/operator.entity.js';
import { ChannelAvailability } from '../modules/channel/channel-availability.entity.js';
import { Channel } from '../modules/channel/channel.entity.js';
import { Conflict } from '../modules/conflict/conflict.entity.js';
import { EventLog } from '../modules/event-log/event-log.entity.js';
import { Inventory } from '../modules/inventory/inventory.entity.js';
import { Reservation } from '../modules/reservation/reservation.entity.js';
import { RoomType } from '../modules/room-type/room-type.entity.js';
import { SimulationRun } from '../modules/simulator/simulation-run.entity.js';
import type { Env } from './env.validation.js';

export const ENTITIES = [
  RoomType,
  Inventory,
  Channel,
  ChannelAvailability,
  Reservation,
  Conflict,
  EventLog,
  Operator,
  SimulationRun,
];

export const MIGRATIONS = [Init1760000000000];

type DbEnv = Pick<Env, 'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'>;

export function dataSourceOptions(env: DbEnv): DataSourceOptions {
  return {
    type: 'mariadb',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false, // 스키마는 마이그레이션으로만 바꾼다
    migrationsRun: false,
    timezone: 'Z', // DATETIME은 UTC로 저장한다
    dateStrings: ['DATE'], // 숙박일(DATE)은 시간대 변환 없이 'YYYY-MM-DD' 문자열로 다룬다 (NFR-08)
    charset: 'utf8mb4_unicode_ci',
    poolSize: 30,
  };
}
