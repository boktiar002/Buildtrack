import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../context/request-context';

/**
 * Runs first on every request. Opens a request context holding the request id
 * and the caller's IP address, so the audit log can record where a change came from.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, _res: Response, next: NextFunction) {
    const ip = (req.ip ?? req.socket.remoteAddress ?? '').replace(/^::ffff:/, '') || undefined;
    requestContext.run({ requestId: req.id, ip }, () => next());
  }
}
