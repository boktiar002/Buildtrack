import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Tests always use their own database and a throwaway storage folder,
// so they can never touch development data.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://buildtrack:buildtrack@localhost:5432/buildtrack_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';
process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), 'buildtrack-test-'));
process.env.AI_PROVIDER = 'mock';
process.env.SCHEDULER_ENABLED = 'false';
process.env.LOG_LEVEL = 'silent';
process.env.SMTP_HOST = '';
