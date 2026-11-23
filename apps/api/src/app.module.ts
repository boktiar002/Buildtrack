import { ClassSerializerInterceptor, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TimingInterceptor } from './common/interceptors/timing.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CsrfOriginMiddleware } from './common/middleware/csrf-origin.middleware';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { loadEnv } from './config/env';
import { buildDataSourceOptions } from './database/data-source';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PublicModule } from './modules/public/public.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { StorageModule } from './modules/storage/storage.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UpdatesModule } from './modules/updates/updates.module';
import { UsersModule } from './modules/users/users.module';

const env = loadEnv();

@Module({
  imports: [
    // .env is read once at startup and validated (config/env.ts); the app refuses to start on bad settings.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, cache: true, validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv) }),
    LoggerModule.forRoot({
      // Modern route syntax; the library default ('*') makes Nest 11 print a warning.
      forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: env.LOG_LEVEL,
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        // Never write passwords, tokens or cookies to the logs.
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.passwordHash'],
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        // Log only what is useful for tracing a request, never headers or bodies.
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        transport:
          env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
            : undefined,
      },
    }),
    TypeOrmModule.forRoot({
      ...buildDataSourceOptions(env.DATABASE_URL),
      migrationsRun: true, // the database schema is always brought up to date on startup
      retryAttempts: 10,
      retryDelay: 3000,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: env.NODE_ENV === 'test' ? 10_000 : 300 }]),
    CommonModule,
    AuditModule,
    MailModule,
    StorageModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    FinanceModule,
    AiModule,
    UpdatesModule,
    DocumentsModule,
    TicketsModule,
    SchedulerModule,
    DashboardModule,
    PublicModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptors run outermost-first on the way in: timing, then the envelope, then serialization (@Exclude).
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }, // innermost: sees the raw result of each change
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1) request context (request id + IP for the audit log), 2) cross-site request forgery check.
    consumer.apply(RequestContextMiddleware, CsrfOriginMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
