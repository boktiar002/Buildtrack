/**
 * Checks each CSC4161 minimum and bonus requirement against the running API:
 * CRUD with correct status codes and paging, JWT register/login with roles,
 * DTO validation, the error shape, a transaction that rolls back, the audit log,
 * the response envelope and database CHECK constraints.
 */
import { auth, bootstrap, Ctx } from './helpers';

let c: Ctx;
const S: Record<string, string> = {};
const inYears = (n: number) => new Date(Date.now() + n * 365 * 86_400_000).toISOString();

beforeAll(async () => {
  c = await bootstrap();
});
afterAll(async () => {
  await c.app.close();
});

describe('authentication and authorization (JWT)', () => {
  it('registers a buyer: 201 with the envelope, a token, and no password hash', async () => {
    const r = await c
      .http()
      .post('/api/v1/auth/register')
      .send({ name: 'Rafiq Islam', email: 'rafiq@test.local', password: 'Flat2026ok', organizationSlug: 'test-dev' })
      .expect(201);
    expect(r.body).toMatchObject({ success: true, message: 'Account created', meta: null });
    expect(r.body.data.user).toMatchObject({ email: 'rafiq@test.local', role: 'BUYER' });
    expect(r.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    S.newBuyerToken = r.body.data.accessToken;
  });

  it('stores the password as a bcrypt hash', async () => {
    const [row] = await c.db.query(`SELECT "passwordHash" FROM users WHERE email = 'rafiq@test.local'`);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('refuses a duplicate email with 409', async () => {
    const r = await c
      .http()
      .post('/api/v1/auth/register')
      .send({ name: 'Someone', email: 'RAFIQ@test.local', password: 'Another123', organizationSlug: 'test-dev' })
      .expect(409);
    expect(r.body).toMatchObject({ success: false, statusCode: 409, error: 'Conflict' });
  });

  it('rejects an invalid body with 400 naming each failing field', async () => {
    const r = await c.http().post('/api/v1/auth/register').send({ name: 'X', email: 'not-an-email', password: 'short' }).expect(400);
    const text = JSON.stringify(r.body.message);
    expect(text).toContain('name');
    expect(text).toContain('email');
    expect(text).toContain('password');
  });

  it('returns 401 without a token, with path and timestamp in the error', async () => {
    const r = await c.http().get('/api/v1/projects').expect(401);
    expect(r.body).toMatchObject({ success: false, statusCode: 401, error: 'Unauthorized', path: '/api/v1/projects' });
    expect(new Date(r.body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('returns 403 when a buyer calls a staff route', async () => {
    await c
      .http()
      .post('/api/v1/projects')
      .set(auth(S.newBuyerToken))
      .send({ name: 'Nope', location: 'Dhaka', totalFloors: 5, originalHandoverDate: inYears(2) })
      .expect(403);
  });
});

describe('projects: full CRUD with paging', () => {
  it('creates (201), reads (200), updates (200)', async () => {
    const r = await c
      .http()
      .post('/api/v1/projects')
      .set(auth(c.token.manager))
      .send({
        name: 'Lake View',
        location: 'Gulshan, Dhaka',
        totalFloors: 6,
        startDate: new Date().toISOString(),
        originalHandoverDate: inYears(2),
      })
      .expect(201);
    expect(r.body.message).toBe('Project created');
    S.project = r.body.data.id;
    await c.http().get(`/api/v1/projects/${S.project}`).set(auth(c.token.manager)).expect(200);
    const u = await c
      .http()
      .patch(`/api/v1/projects/${S.project}`)
      .set(auth(c.token.manager))
      .send({ location: 'Gulshan 2, Dhaka' })
      .expect(200);
    expect(u.body.data.location).toBe('Gulshan 2, Dhaka');
  });

  it('lists with pagination metadata', async () => {
    await c
      .http()
      .post('/api/v1/projects')
      .set(auth(c.token.manager))
      .send({ name: 'Second Tower', location: 'Uttara, Dhaka', totalFloors: 4, originalHandoverDate: inYears(3) })
      .expect(201);
    const r = await c.http().get('/api/v1/projects?page=1&pageSize=1').set(auth(c.token.manager)).expect(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.meta).toEqual({ total: 2, page: 1, pageSize: 1, totalPages: 2 });
    const s = await c.http().get('/api/v1/projects?search=second').set(auth(c.token.manager)).expect(200);
    expect(s.body.data.map((p: { name: string }) => p.name)).toEqual(['Second Tower']);
    S.otherProject = s.body.data[0].id;
  });

  it('returns 404 for an unknown id and 400 for a malformed id', async () => {
    await c.http().get('/api/v1/projects/00000000-0000-4000-8000-000000000000').set(auth(c.token.manager)).expect(404);
    await c.http().get('/api/v1/projects/not-a-uuid').set(auth(c.token.manager)).expect(400);
  });

  it('lets only an admin delete, and returns 204', async () => {
    await c.http().delete(`/api/v1/projects/${S.otherProject}`).set(auth(c.token.manager)).expect(403);
    const other = await c
      .http()
      .post('/api/v1/projects')
      .set(auth(c.token.manager))
      .send({ name: 'Temporary', location: 'Mirpur, Dhaka', totalFloors: 3, originalHandoverDate: inYears(2) })
      .expect(201);
    await c.http().delete(`/api/v1/projects/${other.body.data.id}`).set(auth(c.token.admin)).expect(204);
    await c.http().get(`/api/v1/projects/${other.body.data.id}`).set(auth(c.token.admin)).expect(404);
  });
});

describe('milestones and units: CRUD', () => {
  it('creates, reads and deletes a stage', async () => {
    const m = await c
      .http()
      .post(`/api/v1/projects/${S.project}/milestones`)
      .set(auth(c.token.manager))
      .send({ name: 'Boundary wall', weight: 2 })
      .expect(201);
    await c.http().get(`/api/v1/milestones/${m.body.data.id}`).set(auth(c.token.manager)).expect(200);
    const list = await c.http().get(`/api/v1/projects/${S.project}/milestones`).set(auth(c.token.manager)).expect(200);
    expect(list.body.data.some((x: { id: string }) => x.id === m.body.data.id)).toBe(true);
    await c.http().delete(`/api/v1/milestones/${m.body.data.id}`).set(auth(c.token.manager)).expect(204);
    await c.http().get(`/api/v1/milestones/${m.body.data.id}`).set(auth(c.token.manager)).expect(404);
  });

  it('refuses to delete a stage that already has progress (409)', async () => {
    const list = await c.http().get(`/api/v1/projects/${S.project}/milestones`).set(auth(c.token.manager)).expect(200);
    S.stage1 = list.body.data[0].id;
    await c.http().patch(`/api/v1/milestones/${S.stage1}/progress`).set(auth(c.token.manager)).send({ progress: 40 }).expect(200);
    const r = await c.http().delete(`/api/v1/milestones/${S.stage1}`).set(auth(c.token.manager)).expect(409);
    expect(r.body.message).toContain('Work has already been recorded');
  });

  it('creates, reads, updates and deletes a flat; lists with paging', async () => {
    const r = await c
      .http()
      .post(`/api/v1/projects/${S.project}/units`)
      .set(auth(c.token.manager))
      .send({
        units: [
          { code: 'A-1', floor: 1, sizeSqft: 1200, bedrooms: 3, listPrice: '9000000' },
          { code: 'A-2', floor: 1, sizeSqft: 1300, bedrooms: 3, listPrice: '9500000' },
          { code: 'B-1', floor: 2, sizeSqft: 1250, bedrooms: 3, listPrice: '9200000' },
        ],
      })
      .expect(201);
    expect(r.body.message).toBe('Flats added');
    const page = await c.http().get(`/api/v1/projects/${S.project}/units?page=1&pageSize=2`).set(auth(c.token.manager)).expect(200);
    expect(page.body.meta).toMatchObject({ total: 3, pageSize: 2, totalPages: 2 });
    const all = await c.http().get(`/api/v1/projects/${S.project}/units?pageSize=100`).set(auth(c.token.manager)).expect(200);
    const byCode = (code: string) => all.body.data.find((u: { code: string }) => u.code === code).id;
    S.unitA1 = byCode('A-1');
    S.unitB1 = byCode('B-1');
    await c.http().get(`/api/v1/units/${S.unitA1}`).set(auth(c.token.manager)).expect(200);
    await c.http().patch(`/api/v1/units/${S.unitB1}`).set(auth(c.token.manager)).send({ listPrice: '9300000' }).expect(200);
    await c.http().delete(`/api/v1/units/${S.unitB1}`).set(auth(c.token.manager)).expect(204);
    await c.http().get(`/api/v1/units/${S.unitB1}`).set(auth(c.token.manager)).expect(404);
  });

  it('refuses a duplicate flat code with 409', async () => {
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/units`)
      .set(auth(c.token.manager))
      .send({ units: [{ code: 'A-1', floor: 1, sizeSqft: 1200, listPrice: '9000000' }] })
      .expect(409);
  });
});

describe('transaction: booking a flat', () => {
  const plan = (stageId: string) => ({
    unitId: S.unitA1,
    buyerId: c.ids.buyer1,
    bookingDate: new Date().toISOString(),
    totalPrice: '9000000',
    installments: [
      { label: 'Booking money', amount: '900000', dueType: 'FIXED_DATE', dueDate: new Date().toISOString() },
      { label: 'On completion of a stage', amount: '8100000', dueType: 'MILESTONE', milestoneId: stageId },
    ],
  });

  it('rolls back everything when a step fails part-way (stage of another project)', async () => {
    const before = await c.db.query(`SELECT COUNT(*)::int AS n FROM purchases`);
    const stages = await c.http().get(`/api/v1/projects/${S.otherProject}/milestones`).set(auth(c.token.manager)).expect(200);
    const r = await c.http().post('/api/v1/purchases').set(auth(c.token.manager)).send(plan(stages.body.data[0].id)).expect(400);
    expect(r.body.message).toContain('choose a construction stage of this project');
    const after = await c.db.query(`SELECT COUNT(*)::int AS n FROM purchases`);
    expect(after[0].n).toBe(before[0].n);
    const [unit] = await c.db.query(`SELECT status FROM units WHERE id = $1`, [S.unitA1]);
    expect(unit.status).toBe('AVAILABLE');
    const installments = await c.db.query(`SELECT COUNT(*)::int AS n FROM installments`);
    expect(installments[0].n).toBe(0);
  });

  it('commits booking, installments and flat status together when every step succeeds', async () => {
    const r = await c.http().post('/api/v1/purchases').set(auth(c.token.manager)).send(plan(S.stage1)).expect(201);
    expect(r.body.message).toBe('Booking recorded');
    expect(r.body.data.installments).toHaveLength(2);
    const [unit] = await c.db.query(`SELECT status FROM units WHERE id = $1`, [S.unitA1]);
    expect(unit.status).toBe('BOOKED');
    S.purchase = r.body.data.id;
  });

  it('refuses to delete a booked flat (409)', async () => {
    await c.http().delete(`/api/v1/units/${S.unitA1}`).set(auth(c.token.manager)).expect(409);
  });

  it('the database itself rejects a negative payment (CHECK constraint)', async () => {
    await expect(
      c.db.query(
        `INSERT INTO payments ("purchaseId", amount, method, "paidAt", "receiptNumber", "recordedById") VALUES ($1, -5, 'CASH', now(), 'X-1', $2)`,
        [S.purchase, c.ids.manager],
      ),
    ).rejects.toThrow(/CHK_payment_amount/);
  });
});

describe('users: read and deactivate', () => {
  it('reads one user and deactivates them; they can no longer sign in', async () => {
    await c.http().get(`/api/v1/users/${c.ids.engineer2}`).set(auth(c.token.admin)).expect(200);
    await c.http().delete(`/api/v1/users/${c.ids.engineer2}`).set(auth(c.token.admin)).expect(204);
    await c.http().post('/api/v1/auth/login').send({ email: 'engineer2@test.local', password: 'Test@12345' }).expect(401);
    await c.http().delete(`/api/v1/users/${c.ids.admin}`).set(auth(c.token.admin)).expect(409);
  });
});

describe('audit log, response timing and envelope', () => {
  it('records who changed what, with old and new values and the IP address', async () => {
    const r = await c.http().get('/api/v1/audit-logs?entity=Project&pageSize=50').set(auth(c.token.admin)).expect(200);
    const update = r.body.data.find((a: { action: string; entityId: string }) => a.action === 'UPDATE' && a.entityId === S.project);
    expect(update).toMatchObject({ entity: 'Project', actorId: c.ids.manager, newValue: { location: 'Gulshan 2, Dhaka' } });
    expect(update.ipAddress).toBeTruthy();
    const del = await c.http().get('/api/v1/audit-logs?action=DELETE&entity=Unit').set(auth(c.token.admin)).expect(200);
    expect(del.body.data[0].oldValue).toMatchObject({ code: 'B-1' });
    await c.http().get(`/api/v1/audit-logs/${update.id}`).set(auth(c.token.admin)).expect(200);
  });

  it('never stores passwords in the audit log', async () => {
    const rows = await c.db.query(`SELECT "newValue"::text AS v FROM audit_logs WHERE "newValue" IS NOT NULL`);
    expect(rows.map((r: { v: string }) => r.v).join(' ')).not.toMatch(/password/i);
  });

  it('is visible to admins only', async () => {
    await c.http().get('/api/v1/audit-logs').set(auth(c.token.manager)).expect(403);
  });

  it('adds an X-Response-Time header', async () => {
    const r = await c.http().get('/api/v1/projects').set(auth(c.token.manager)).expect(200);
    expect(r.headers['x-response-time']).toMatch(/^\d+(\.\d+)?ms$/);
  });
});
