import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';
import { currentRequest } from '../context/request-context';
import { AuthUser } from '../interfaces/auth-user.interface';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
/** Requests that do not change business records (sign-in, chat questions, read receipts, dev tools). */
const SKIP = /^\/api\/v1\/(auth|assistant|notifications|dev|ai\/reindex)\b/;

const ENTITY: Record<string, string> = {
  projects: 'Project',
  milestones: 'Milestone',
  units: 'Unit',
  purchases: 'Purchase',
  payments: 'Payment',
  installments: 'Installment',
  documents: 'Document',
  tickets: 'Ticket',
  messages: 'TicketMessage',
  updates: 'ProgressUpdate',
  users: 'User',
  buyers: 'User',
  assignments: 'ProjectAssignment',
  cover: 'Project',
  template: 'Milestone',
  import: 'Unit',
  'handover-date': 'Project',
  risk: 'DelayRiskScore',
};
const VERB: Record<string, string> = { POST: 'CREATE', PATCH: 'UPDATE', PUT: 'UPDATE', DELETE: 'DELETE' };

/**
 * Audit trail for every create, update and delete. Services write detailed
 * business entries (with before/after values) for money and dates; for any
 * other change this interceptor writes a generic entry with the new values.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!MUTATING.has(req.method) || SKIP.test(req.originalUrl)) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const user = req.user;
        if (!user || currentRequest()?.audited) return;
        const segments = (req.route?.path ?? req.path)
          .split('/')
          .filter((s: string) => s && !s.startsWith(':') && s !== 'api' && s !== 'v1');
        const last = segments.at(-1) ?? '';
        const known = [...segments].reverse().find((s) => ENTITY[s]);
        const entity = known ? ENTITY[known] : last;
        const action = ENTITY[last] ? VERB[req.method] : last.toUpperCase().replace(/-/g, '_');
        const id = (result as { id?: string } | null)?.id ?? (req.params.id as string | undefined) ?? '-';
        const body = req.is('multipart/form-data') ? { file: 'uploaded' } : (req.body as Record<string, unknown>);
        void this.audit.log(user, action || VERB[req.method], entity, String(id), { newValue: req.method === 'DELETE' ? null : body });
      }),
    );
  }
}
