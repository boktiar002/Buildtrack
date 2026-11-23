import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES } from '../decorators/roles.decorator';
import { Role } from '../enums';
import { AuthUser } from '../interfaces/auth-user.interface';

/** Global guard: enforces @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user) return true; // JwtAuthGuard already decided (public route)
    if (!roles.includes(user.role)) throw new ForbiddenException('You do not have permission to do this.');
    return true;
  }
}
