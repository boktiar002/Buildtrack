import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE } from '../decorators/response-message.decorator';

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Envelope<T> {
  success: true;
  message: string;
  data: T;
  meta: PageMeta | null;
}

const DEFAULT_MESSAGE: Record<string, string> = {
  GET: 'OK',
  POST: 'Created',
  PATCH: 'Updated',
  PUT: 'Updated',
  DELETE: 'Deleted',
};

function isPage(v: unknown): v is { items: unknown[]; total: number; page: number; pageSize: number } {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as { items?: unknown }).items) &&
    typeof (v as { total?: unknown }).total === 'number' &&
    typeof (v as { pageSize?: unknown }).pageSize === 'number'
  );
}

/**
 * Wraps every JSON success response in one envelope:
 *   { success: true, message, data, meta }
 * Paginated results ({ items, total, page, pageSize }) put the items in `data`
 * and the paging details in `meta`. Files and CSV downloads pass through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Envelope<unknown> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<Envelope<unknown> | T> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const message = this.reflector.get<string>(RESPONSE_MESSAGE, ctx.getHandler()) ?? DEFAULT_MESSAGE[req.method] ?? 'OK';

    return next.handle().pipe(
      map((value) => {
        const type = String(res.getHeader('Content-Type') ?? '');
        if (value instanceof StreamableFile || Buffer.isBuffer(value) || (type && !type.includes('json'))) return value;
        if (isPage(value)) {
          const { items, total, page, pageSize } = value;
          const meta: PageMeta = { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
          return { success: true as const, message, data: items, meta };
        }
        return { success: true as const, message, data: (value ?? null) as unknown, meta: null };
      }),
    );
  }
}
