import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/auth/public.decorator.js';
import { MetricsService } from '../../common/metrics/metrics.service.js';

// Kubernetes 프로브와 Prometheus 수집 경로. Ingress에 노출하지 않는다 (docs/2-design/api.md)
@ApiExcludeController()
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 1_500 })]);
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4')
  scrape() {
    return this.metrics.registry.metrics();
  }
}
