import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/enums';
import { configureApp } from '../src/main';
import { hashPassword } from '../src/modules/auth/auth.service';
import { Organization } from '../src/modules/users/entities/organization.entity';
import { User } from '../src/modules/users/entities/user.entity';

export const PASSWORD = 'Test@12345';

export interface Ctx {
  app: INestApplication;
  db: DataSource;
  http: () => ReturnType<typeof request>;
  token: Record<string, string>;
  ids: Record<string, string>;
}

/** Boots the real app against the test database, wipes it, and creates two organizations with users. */
export async function bootstrap(): Promise<Ctx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false, bodyParser: false });
  configureApp(app);
  await app.init();
  const db = app.get(DataSource);
  const tables: Array<{ tablename: string }> = await db.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  await db.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);

  const hash = await hashPassword(PASSWORD);
  const ids: Record<string, string> = {};
  const org = await db.getRepository(Organization).save({ name: 'Test Developer', slug: 'test-dev', receiptPrefix: 'TST' });
  const other = await db.getRepository(Organization).save({ name: 'Other Developer', slug: 'other-dev' });
  ids.org = org.id;
  ids.otherOrg = other.id;
  const users: Array<[string, Role, string]> = [
    ['admin', Role.ORG_ADMIN, org.id],
    ['manager', Role.MANAGER, org.id],
    ['engineer', Role.ENGINEER, org.id],
    ['engineer2', Role.ENGINEER, org.id],
    ['buyer1', Role.BUYER, org.id],
    ['buyer2', Role.BUYER, org.id],
    ['otherAdmin', Role.ORG_ADMIN, other.id],
  ];
  for (const [key, role, orgId] of users) {
    const u = await db.getRepository(User).save({
      organizationId: orgId,
      role,
      name: key,
      email: `${key.toLowerCase()}@test.local`,
      phone: '+8801700000000',
      passwordHash: hash,
    });
    ids[key] = u.id;
  }
  // One listening server for all requests (avoids re-binding a port per request).
  const server = app.getHttpServer();
  await new Promise<void>((r) => server.listen(0, r));
  const http = () => request(server);
  const token: Record<string, string> = {};
  for (const [key] of users) {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: `${key.toLowerCase()}@test.local`, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed for ${key}: ${res.status} ${JSON.stringify(res.body)}`);
    token[key] = res.body.data.accessToken;
  }
  return { app, db, http, token, ids };
}

export const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

export async function testPhoto(label = 'site') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="100%" height="100%" fill="#8899aa"/>
    <rect x="200" y="200" width="600" height="400" fill="#556677"/><text x="40" y="80" font-size="48" fill="#fff">${label}</text></svg>`;
  return sharp(Buffer.from(svg))
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: 'TestPhone' }, GPS: { GPSLatitudeRef: 'N', GPSLatitude: '23/1 48/1 0/1' } } } as never)
    .toBuffer();
}

/** Waits until background work (notifications) has settled. */
export const settle = () => new Promise((r) => setTimeout(r, 150));
