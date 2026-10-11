import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

// Prometheus 지표 (NFR-05). 문제 정의의 목표 1(충돌 창 축소)과 3(즉시 감지)을 운영 지표로 추적한다.
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly reservations = new Counter({
    name: 'restella_reservations_total',
    help: '예약 수신 결과별 건수',
    labelNames: ['result'] as const, // CONFIRMED | REJECTED | CONFLICT | DUPLICATE
    registers: [this.registry],
  });

  readonly syncLatency = new Histogram({
    name: 'restella_sync_latency_seconds',
    help: '재고 변경부터 채널 전송 성공까지 걸린 시간 (AC-11-2)',
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    registers: [this.registry],
  });

  readonly syncFailures = new Counter({
    name: 'restella_sync_failures_total',
    help: '채널 동기화 전송 실패 건수',
    labelNames: ['channel', 'final'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'restella_http_request_duration_seconds',
    help: 'API 응답 시간 (NFR-02)',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 2.5],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'restella_' });
  }
}
