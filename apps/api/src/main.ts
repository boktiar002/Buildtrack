import 'reflect-metadata';
import { config as loadDotenv } from './database/dotenv';
loadDotenv();

import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** Applies the same settings to the real server and to automated tests. */
export function configureApp(app: INestApplication) {
  const env = loadEnv();
  const express = app as NestExpressApplication;
  express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(compression()); // gzip JSON responses; images and PDFs are skipped automatically
  app.use(cookieParser());
  express.useBodyParser('json', { limit: '1mb' });
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // and reject requests that contain them
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks(); // finish in-flight requests and close the database cleanly
}

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(PinoLogger));
  configureApp(app);

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BuildTrack API')
      .setDescription(
        'Construction progress and payment transparency for under-construction flats in Bangladesh. ' +
          'Sign in with POST /auth/login, copy data.accessToken, then press Authorize. ' +
          'Every success response is { success, message, data, meta }; every error is { success: false, statusCode, error, message, path, timestamp }.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .addSecurityRequirements('bearer')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: 'none', tagsSorter: 'alpha' },
      customSiteTitle: 'BuildTrack API docs',
    });
  }

  await app.listen(env.PORT);
  Logger.log(`BuildTrack API ready on http://localhost:${env.PORT}/api/v1 (docs: /api/docs)`, 'Bootstrap');
}

// Last line of defence: log unexpected errors instead of dying silently.
process.on('unhandledRejection', (reason) => Logger.error({ reason }, 'Unhandled promise rejection', 'Process'));
process.on('uncaughtException', (err) => {
  Logger.error({ err }, 'Uncaught exception: shutting down so the process manager can restart cleanly', 'Process');
  setTimeout(() => process.exit(1), 500).unref();
});

if (require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('BuildTrack API failed to start:', err?.message ?? err);
    process.exit(1);
  });
}
