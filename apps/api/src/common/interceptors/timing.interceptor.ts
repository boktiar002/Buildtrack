import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Adds an X-Response-Time header (milliseconds spent handling the request) to every response. */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const started = process.hrtime.bigint();
    const res = ctx.switchToHttp().getResponse<Response>();
    const stamp = () => {
      if (!res.headersSent) res.setHeader('X-Response-Time', `${(Number(process.hrtime.bigint() - started) / 1e6).toFixed(1)}ms`);
    };
    return next.handle().pipe(tap({ next: stamp, error: stamp }));
  }
}
