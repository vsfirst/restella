import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, type Observable } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const stop = this.metrics.httpDuration.startTimer();
    return next.handle().pipe(
      finalize(() => {
        // 경로 템플릿(:id 등)으로 기록해 라벨 수가 늘어나지 않게 한다
        const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
        stop({ method: req.method, route, status: String(http.getResponse<Response>().statusCode) });
      }),
    );
  }
}
