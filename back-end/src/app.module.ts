import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorAuthGuard } from './common/auth/operator-auth.guard.js';
import { ProblemFilter } from './common/http/problem.js';
import { HttpMetricsInterceptor } from './common/metrics/http-metrics.interceptor.js';
import { MetricsModule } from './common/metrics/metrics.module.js';
import { type Env, validateEnv } from './config/env.validation.js';
import { dataSourceOptions } from './config/typeorm.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelModule } from './modules/channel/channel.module.js';
import { ConflictModule } from './modules/conflict/conflict.module.js';
import { EventLogModule } from './modules/event-log/event-log.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { ReservationModule } from './modules/reservation/reservation.module.js';
import { RoomTypeModule } from './modules/room-type/room-type.module.js';
import { SimulatorModule } from './modules/simulator/simulator.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        dataSourceOptions({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USER: config.get('DB_USER', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
        }),
    }),
    ScheduleModule.forRoot(),
    // 기본 한도는 넉넉히 두고, 로그인처럼 민감한 경로만 @Throttle로 좁힌다
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 10_000 }] }),
    MetricsModule,
    EventLogModule,
    RoomTypeModule,
    ChannelModule,
    InventoryModule,
    ReservationModule,
    ConflictModule,
    AuthModule,
    SimulatorModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OperatorAuthGuard },
    { provide: APP_FILTER, useClass: ProblemFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
