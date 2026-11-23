import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { loadEnv } from '../../config/env';
import { ACCESS_COOKIE } from '../constants/auth.constants';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { Role } from '../enums';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * The token is read from the httpOnly cookie, or from an Authorization: Bearer
 * header (useful for Postman and automated tests).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    // An explicit Authorization header (Swagger, Postman, mobile clients) wins over the browser cookie.
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? (req.cookies?.[ACCESS_COOKIE] as string | undefined);

    if (token) {
      try {
        const p = this.jwt.verify<{ sub: string; org: string; role: Role; name: string; email: string }>(token, {
          secret: loadEnv().JWT_ACCESS_SECRET,
        });
        req.user = { id: p.sub, orgId: p.org, role: p.role, name: p.name, email: p.email };
      } catch {
        if (!isPublic) throw new UnauthorizedException('Your session has expired. Please sign in again.');
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Please sign in.');
    return true;
  }
}
