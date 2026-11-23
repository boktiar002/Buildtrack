import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../../config/env';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cross-site request forgery protection for cookie-based auth.
 * Cookies are SameSite=Lax; in addition, any state-changing request that
 * carries an Origin header must come from the web app's own origin.
 */
@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  private readonly allowed = new Set([loadEnv().WEB_ORIGIN, loadEnv().PUBLIC_API_URL].map((u) => u.replace(/\/$/, '')));

  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE.has(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !this.allowed.has(origin.replace(/\/$/, ''))) {
      throw new ForbiddenException('Request blocked: unknown origin.');
    }
    next();
  }
}
