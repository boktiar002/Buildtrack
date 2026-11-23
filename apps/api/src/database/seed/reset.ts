import { rmSync } from 'fs';
import { resolve } from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../data-source';
import { config } from '../dotenv';

config();

/** Development only: wipes the database so migrations and seed can start fresh. */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database.');
  const ds = await new DataSource(buildDataSourceOptions()).initialize();
  await ds.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await ds.destroy();
  // Also remove uploaded files that belonged to the old data.
  rmSync(resolve(process.env.STORAGE_DIR ?? './storage'), { recursive: true, force: true });
  console.log('Database reset.');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
