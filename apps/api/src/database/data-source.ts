import { join } from 'path';
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config as loadDotenv } from './dotenv';
import { ENTITIES } from './entities';

loadDotenv();

/** Shared by the Nest app, the TypeORM CLI (migrations) and the seed script. */
export function buildDataSourceOptions(url = process.env.DATABASE_URL): DataSourceOptions {
  if (!url) throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env.');
  return {
    type: 'postgres',
    url,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: ENTITIES,
    // Versioned schema changes live in the project-root migrations/ folder (dist/migrations after a build).
    migrations: [join(__dirname, '../../migrations/*.{ts,js}')],
    migrationsTableName: 'migrations',
    synchronize: false,
    // Connection pool limits and timeouts so a slow database cannot hang the API.
    extra: { max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 15000 },
  };
}

export default new DataSource(buildDataSourceOptions());
