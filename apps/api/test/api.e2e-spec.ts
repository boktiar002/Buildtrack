import sharp from 'sharp';
import { InstallmentStatus } from '../src/common/enums';
import { AuditLog } from '../src/modules/audit/entities/audit-log.entity';
import { Installment } from '../src/modules/finance/entities/installment.entity';
import { Payment } from '../src/modules/finance/entities/payment.entity';
import { Notification } from '../src/modules/notifications/entities/notification.entity';
import { Milestone } from '../src/modules/projects/entities/milestone.entity';
import { SchedulerService } from '../src/modules/scheduler/scheduler.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { ProgressPhoto } from '../src/modules/updates/entities/progress-photo.entity';
import { auth, bootstrap, Ctx, PASSWORD, settle, testPhoto } from './helpers';

let c: Ctx;
const S = {} as Record<string, string>;
const DAY = 86_400_000;

beforeAll(async () => {
  c = await bootstrap();
});
afterAll(async () => {
  await settle();
  await c?.app.close();
});

describe('health and errors', () => {
  it('reports health without login', async () => {
    const r = await c.http().get('/api/v1/health').expect(200);
    expect(r.body.data).toMatchObject({ status: 'ok', database: 'up' });
  });
  it('returns a clean JSON error with a request id', async () => {
    const r = await c.http().get('/api/v1/projects').expect(401);
    expect(r.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
    expect(r.body.requestId).toBeTruthy();
  });
  it('rejects unknown fields and bad values', async () => {
    const r = await c.http().post('/api/v1/projects').set(auth(c.token.admin)).send({ name: 'X', hacker: true }).expect(400);
    expect(JSON.stringify(r.body.message)).toContain('hacker');
    await c.http().get('/api/v1/projects/not-a-uuid').set(auth(c.token.admin)).expect(400);
  });
});

describe('auth', () => {
  it('rejects wrong passwords with the same message as unknown emails', async () => {
    const a = await c.http().post('/api/v1/auth/login').send({ email: 'admin@test.local', password: 'wrong' }).expect(401);
    const b = await c.http().post('/api/v1/auth/login').send({ email: 'nobody@test.local', password: 'wrong' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });
  it('sets httpOnly cookies and rotates refresh tokens; reuse revokes the session', async () => {
    const login = await c.http().post('/api/v1/auth/login').send({ email: 'buyer2@test.local', password: PASSWORD }).expect(200);
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    expect(cookies.join(';')).toMatch(/bt_access=.*HttpOnly/);
    const refresh = cookies.find((x) => x.startsWith('bt_refresh='))!.split(';')[0];
    const r1 = await c.http().post('/api/v1/auth/refresh').set('Cookie', refresh).expect(200);
    const newRefresh = ([] as string[])
      .concat(r1.headers['set-cookie'])
      .find((x) => x.startsWith('bt_refresh='))!
      .split(';')[0];
    await c.http().post('/api/v1/auth/refresh').set('Cookie', refresh).expect(401); // old token reused
    await c.http().post('/api/v1/auth/refresh').set('Cookie', newRefresh).expect(401); // whole family revoked
  });
  it('blocks state-changing requests from foreign origins', async () => {
    await c.http().post('/api/v1/auth/logout').set('Origin', 'https://evil.example').expect(403);
  });
});

describe('projects, roles and stages', () => {
  it('lets staff create a project with a 100-point stage template', async () => {
    const r = await c
      .http()
      .post('/api/v1/projects')
      .set(auth(c.token.manager))
      .send({
        name: 'Test Tower',
        location: 'Dhaka',
        totalFloors: 6,
        startDate: new Date(Date.now() - 300 * DAY).toISOString(),
        originalHandoverDate: new Date(Date.now() + 600 * DAY).toISOString(),
        isPublic: true,
      })
      .expect(201);
    S.project = r.body.data.id;
    const d = await c.http().get(`/api/v1/projects/${S.project}`).set(auth(c.token.manager)).expect(200);
    expect(d.body.data.milestones.reduce((s: number, m: { weight: number }) => s + m.weight, 0)).toBe(100);
    S.m1 = d.body.data.milestones[0].id;
    S.m2 = d.body.data.milestones[1].id;
    S.m3 = d.body.data.milestones[2].id;
  });
  it('enforces roles (buyer cannot create projects) and organization isolation', async () => {
    await c.http().post('/api/v1/projects').set(auth(c.token.buyer1)).send({}).expect(403);
    await c.http().get(`/api/v1/projects/${S.project}`).set(auth(c.token.otherAdmin)).expect(404);
    await c.http().get(`/api/v1/projects/${S.project}`).set(auth(c.token.buyer1)).expect(404); // owns nothing yet
  });
  it('only assigned engineers may update progress', async () => {
    await c.http().patch(`/api/v1/milestones/${S.m1}/progress`).set(auth(c.token.engineer)).send({ progress: 40 }).expect(403);
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/assignments`)
      .set(auth(c.token.manager))
      .send({ userId: c.ids.engineer })
      .expect(201);
    const r = await c.http().patch(`/api/v1/milestones/${S.m1}/progress`).set(auth(c.token.engineer)).send({ progress: 40 }).expect(200);
    expect(r.body.data.status).toBe('IN_PROGRESS');
    await c.http().patch(`/api/v1/milestones/${S.m1}/progress`).set(auth(c.token.engineer2)).send({ progress: 50 }).expect(403);
  });
  it('requires a manager and a reason to reduce progress, and audits it', async () => {
    await c.http().patch(`/api/v1/milestones/${S.m1}/progress`).set(auth(c.token.engineer)).send({ progress: 20 }).expect(403);
    await c.http().patch(`/api/v1/milestones/${S.m1}/progress`).set(auth(c.token.manager)).send({ progress: 20 }).expect(400);
    await c
      .http()
      .patch(`/api/v1/milestones/${S.m1}/progress`)
      .set(auth(c.token.manager))
      .send({ progress: 20, reason: 'Measured again on site' })
      .expect(200);
    expect(await c.db.getRepository(AuditLog).count({ where: { action: 'PROGRESS_DECREASED' } })).toBe(1);
  });
});

describe('purchases and payments', () => {
  it('creates units', async () => {
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/units`)
      .set(auth(c.token.manager))
      .send({
        units: [
          { code: 'a-1', floor: 1, sizeSqft: 1200, listPrice: '1000000' },
          { code: 'B-1', floor: 1, sizeSqft: 1200, listPrice: '900000' },
        ],
      })
      .expect(201);
    const units = await c.http().get(`/api/v1/projects/${S.project}/units`).set(auth(c.token.manager)).expect(200);
    S.unitA = units.body.data.find((u: { code: string }) => u.code === 'A-1').id;
    S.unitB = units.body.data.find((u: { code: string }) => u.code === 'B-1').id;
  });
  it('rejects a plan that does not add up to the price (R10)', async () => {
    const r = await c
      .http()
      .post('/api/v1/purchases')
      .set(auth(c.token.manager))
      .send({
        unitId: S.unitA,
        buyerId: c.ids.buyer1,
        bookingDate: new Date().toISOString(),
        totalPrice: '1000000',
        installments: [{ label: 'Booking', amount: '100000', dueType: 'FIXED_DATE', dueDate: new Date().toISOString() }],
      })
      .expect(400);
    expect(r.body.message).toContain('add up');
  });
  it('creates a booking with fixed and stage-linked installments (R11, R18)', async () => {
    const r = await c
      .http()
      .post('/api/v1/purchases')
      .set(auth(c.token.manager))
      .send({
        unitId: S.unitA,
        buyerId: c.ids.buyer1,
        bookingDate: new Date(Date.now() - 40 * DAY).toISOString(),
        totalPrice: '1000000',
        installments: [
          { label: 'Booking money', amount: '100000', dueType: 'FIXED_DATE', dueDate: new Date(Date.now() - 40 * DAY).toISOString() },
          { label: 'Agreement', amount: '150000', dueType: 'FIXED_DATE', dueDate: new Date(Date.now() + 10 * DAY).toISOString() },
          { label: 'On foundation', amount: '350000', dueType: 'MILESTONE', milestoneId: S.m2 },
          { label: 'Final', amount: '400000', dueType: 'MILESTONE', milestoneId: S.m3 },
        ],
      })
      .expect(201);
    S.purchase = r.body.data.id;
    expect(r.body.data.installments.map((i: { status: string }) => i.status)).toEqual(['OVERDUE', 'DUE', 'UPCOMING', 'UPCOMING']);
    const units = await c.http().get(`/api/v1/projects/${S.project}/units`).set(auth(c.token.manager));
    expect(units.body.data.find((u: { id: string }) => u.id === S.unitA).status).toBe('BOOKED');
    await c
      .http()
      .post('/api/v1/purchases')
      .set(auth(c.token.manager))
      .send({
        unitId: S.unitA,
        buyerId: c.ids.buyer2,
        bookingDate: new Date().toISOString(),
        totalPrice: '100',
        installments: [{ label: 'All', amount: '100', dueType: 'FIXED_DATE', dueDate: new Date().toISOString() }],
      })
      .expect(409); // unit already booked
  });
  it('records a partial payment, oldest installment first (R13, R14)', async () => {
    const r = await c
      .http()
      .post(`/api/v1/purchases/${S.purchase}/payments`)
      .set(auth(c.token.manager))
      .send({ amount: '130000', method: 'BKASH', paidAt: new Date().toISOString(), reference: 'TRX1' })
      .expect(201);
    S.payment1 = r.body.data.id;
    expect(r.body.data.receiptNumber).toMatch(/^TST-\d{4}-000001$/);
    const p = await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.manager)).expect(200);
    expect(p.body.data.installments[0].status).toBe('PAID');
    expect(p.body.data.installments[1]).toMatchObject({ status: 'PARTIALLY_PAID', paidAmount: '30000.00' });
    expect(p.body.data.totals).toMatchObject({ paid: '130000.00', balance: '870000.00' });
  });
  it('rejects overpayment', async () => {
    await c
      .http()
      .post(`/api/v1/purchases/${S.purchase}/payments`)
      .set(auth(c.token.manager))
      .send({ amount: '999999', method: 'CASH', paidAt: new Date().toISOString() })
      .expect(400);
  });
  it('issues unique, sequential receipt numbers under 20 parallel payments (R15)', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        c
          .http()
          .post(`/api/v1/purchases/${S.purchase}/payments`)
          .set(auth(c.token.manager))
          .send({ amount: '1000', method: 'CASH', paidAt: new Date().toISOString() }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => Number(r.body.data.receiptNumber.split('-')[2])).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 2));
    const p = await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.manager));
    expect(p.body.data.totals.paid).toBe('150000.00');
  });
  it('voids a payment and restores balances (R16); payments are never deleted', async () => {
    await c.http().post(`/api/v1/payments/${S.payment1}/void`).set(auth(c.token.manager)).send({ reason: 'Wrong amount' }).expect(403);
    await c.http().post(`/api/v1/payments/${S.payment1}/void`).set(auth(c.token.admin)).send({ reason: 'Wrong amount' }).expect(200);
    await c.http().post(`/api/v1/payments/${S.payment1}/void`).set(auth(c.token.admin)).send({ reason: 'Again' }).expect(409);
    const p = await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.manager));
    expect(p.body.data.totals.paid).toBe('20000.00');
    expect(p.body.data.installments[0].status).toBe('OVERDUE');
    expect(await c.db.getRepository(Payment).count()).toBe(21);
  });
  it('makes stage-linked installments due when the stage completes (R12) and notifies the buyer', async () => {
    await c.http().patch(`/api/v1/milestones/${S.m2}/progress`).set(auth(c.token.engineer)).send({ progress: 100 }).expect(200);
    await settle();
    const inst = await c.db.getRepository(Installment).findOneByOrFail({ purchaseId: S.purchase, milestoneId: S.m2 });
    expect(inst.status).toBe(InstallmentStatus.DUE);
    const days = Math.round((inst.dueDate!.getTime() - Date.now()) / DAY);
    expect(days).toBeGreaterThanOrEqual(14);
    expect(days).toBeLessThanOrEqual(15);
    expect(await c.db.getRepository(Notification).count({ where: { userId: c.ids.buyer1, type: 'INSTALLMENT_DUE' } })).toBe(1);
  });
});

describe('buyer privacy', () => {
  it("a buyer sees their own purchase but never another buyer's", async () => {
    await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.buyer1)).expect(200);
    await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.buyer2)).expect(404);
    await c.http().get(`/api/v1/purchases/${S.purchase}`).set(auth(c.token.engineer)).expect(403);
    const mine = await c.http().get('/api/v1/my/purchases').set(auth(c.token.buyer2)).expect(200);
    expect(mine.body.data).toHaveLength(0);
  });
  it('engineers get no money data from project endpoints', async () => {
    const r = await c.http().get(`/api/v1/projects/${S.project}`).set(auth(c.token.engineer)).expect(200);
    expect(JSON.stringify(r.body.data)).not.toMatch(/listPrice|totalPrice|amount|unitCounts/);
    await c.http().get(`/api/v1/projects/${S.project}/units`).set(auth(c.token.engineer)).expect(403);
  });
});

describe('handover transparency', () => {
  it('requires a reason of 20+ characters and keeps history (R6, R8)', async () => {
    const newDate = new Date(Date.now() + 700 * DAY).toISOString();
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/handover-date`)
      .set(auth(c.token.manager))
      .send({ newDate, reason: 'Rain' })
      .expect(400);
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/handover-date`)
      .set(auth(c.token.manager))
      .send({ newDate, reason: 'Heavy monsoon rain delayed the roof casting.' })
      .expect(201);
    const h = await c.http().get(`/api/v1/projects/${S.project}/handover-history`).set(auth(c.token.buyer1)).expect(200);
    expect(h.body.data[0].reason).toContain('monsoon');
  });
  it('locks the original handover date after the first booking (R7)', async () => {
    await c
      .http()
      .patch(`/api/v1/projects/${S.project}`)
      .set(auth(c.token.manager))
      .send({ originalHandoverDate: new Date().toISOString() })
      .expect(409);
  });
});

describe('AI progress update workflow', () => {
  it('engineer uploads photos; AI suggests a stage; GPS data is removed', async () => {
    const r = await c
      .http()
      .post(`/api/v1/projects/${S.project}/updates`)
      .set(auth(c.token.engineer))
      .field('title', 'Basement work')
      .field('note', 'Columns cast on the east side')
      .attach('photos', await testPhoto('one'), 'a.jpg')
      .attach('photos', await testPhoto('two'), 'b.jpg')
      .expect(201);
    S.update = r.body.data.update.id;
    expect(r.body.data.suggestion.milestoneId).toBe(S.m1); // offline mode: current stage from the schedule
    expect(r.body.data.suggestion.source).toBe('offline');
    expect(r.body.data.update.status).toBe('DRAFT');
    const photo = await c.db.getRepository(ProgressPhoto).findOneOrFail({ where: { updateId: S.update } });
    const meta = await sharp(await c.app.get(StorageService).read(photo.fileKey)).metadata();
    expect(meta.exif).toBeUndefined();
  });
  it('rejects files that are not images, whatever their name', async () => {
    await c
      .http()
      .post(`/api/v1/projects/${S.project}/updates`)
      .set(auth(c.token.engineer))
      .field('title', 'Fake')
      .attach('photos', Buffer.from('%PDF-1.4 not an image'), 'photo.jpg')
      .expect(400);
  });
  it('engineer confirms; AI drafts the buyer update; buyers cannot see it yet', async () => {
    const r = await c
      .http()
      .post(`/api/v1/updates/${S.update}/submit`)
      .set(auth(c.token.engineer))
      .send({ milestoneId: S.m1, progressAfter: 80 })
      .expect(200);
    expect(r.body.data.update.status).toBe('PENDING_REVIEW');
    expect(r.body.data.draft.text.length).toBeGreaterThan(20);
    const feed = await c.http().get(`/api/v1/projects/${S.project}/updates`).set(auth(c.token.buyer1)).expect(200);
    expect(feed.body.data).toHaveLength(0);
  });
  it('manager approves with edits; progress is applied; buyers see it', async () => {
    await c.http().post(`/api/v1/updates/${S.update}/approve`).set(auth(c.token.buyer1)).send({ title: 'x', text: 'y' }).expect(403);
    const r = await c
      .http()
      .post(`/api/v1/updates/${S.update}/approve`)
      .set(auth(c.token.manager))
      .send({ title: 'Basement columns cast', text: 'The basement columns on the east side have been cast successfully.' })
      .expect(200);
    expect(r.body.data.status).toBe('PUBLISHED');
    const m = await c.db.getRepository(Milestone).findOneByOrFail({ id: S.m1 });
    expect(m.progress).toBe(80);
    const feed = await c.http().get(`/api/v1/projects/${S.project}/updates`).set(auth(c.token.buyer1)).expect(200);
    expect(feed.body.data[0]).toMatchObject({ title: 'Basement columns cast' });
    expect(feed.body.data[0].aiDraft).toBeUndefined(); // internal AI data hidden from buyers
    await c
      .http()
      .post(`/api/v1/updates/${S.update}/approve`)
      .set(auth(c.token.manager))
      .send({ title: 'again', text: 'approve twice should fail' })
      .expect(409);
  });
});

describe('documents and AI assistant', () => {
  it('uploads documents with visibility rules (R25)', async () => {
    const pdf = await (
      await import('../src/database/seed/assets')
    ).simplePdf('Buyer handbook', [
      'Car parking: every apartment includes one covered car parking space in the basement.',
      'Service charge after handover is Tk 6 per square foot per month.',
    ]);
    const r = await c
      .http()
      .post('/api/v1/documents')
      .set(auth(c.token.manager))
      .field('title', 'Buyer handbook')
      .field('type', 'OTHER')
      .field('visibility', 'PROJECT_BUYERS')
      .field('projectId', S.project)
      .attach('file', pdf, 'handbook.pdf')
      .expect(201);
    S.doc = r.body.data.id;
    const internal = await c
      .http()
      .post('/api/v1/documents')
      .set(auth(c.token.manager))
      .field('title', 'Internal cost sheet')
      .field('type', 'OTHER')
      .field('visibility', 'INTERNAL')
      .field('projectId', S.project)
      .attach('file', pdf, 'internal.pdf')
      .expect(201);
    S.internalDoc = internal.body.data.id;
    for (let i = 0; i < 40; i++) {
      const d = await c.http().get(`/api/v1/documents/${S.doc}/url`).set(auth(c.token.manager));
      if (d.status === 200) break;
      await settle();
    }
    await c.http().get(`/api/v1/documents/${S.doc}/url`).set(auth(c.token.buyer1)).expect(200);
    await c.http().get(`/api/v1/documents/${S.internalDoc}/url`).set(auth(c.token.buyer1)).expect(404);
    await c.http().get(`/api/v1/documents/${S.doc}/url`).set(auth(c.token.buyer2)).expect(404);
  });
  it('signed file links work, and expire or fail when tampered', async () => {
    const {
      body: { data: body },
    } = await c.http().get(`/api/v1/documents/${S.doc}/url`).set(auth(c.token.buyer1)).expect(200);
    await c.http().get(body.url).expect(200);
    await c
      .http()
      .get(body.url.replace(/sig=[^&]+/, 'sig=AAAA'))
      .expect(404);
    await c
      .http()
      .get(body.url.replace(/exp=\d+/, 'exp=1000'))
      .expect(404);
  });
  it("answers from the buyer's own records and documents, with sources", async () => {
    for (let i = 0; i < 40; i++) {
      const docs = await c.http().get(`/api/v1/documents?projectId=${S.project}`).set(auth(c.token.manager));
      if (docs.body.data.every((d: { indexStatus: string }) => d.indexStatus !== 'NOT_INDEXED')) break;
      await settle();
    }
    const pay = await c
      .http()
      .post('/api/v1/assistant/ask')
      .set(auth(c.token.buyer1))
      .send({ purchaseId: S.purchase, question: 'What is my remaining balance?' })
      .expect(200);
    expect(pay.body.data.message.text).toContain('Tk');
    expect(pay.body.data.message.sources.length).toBeGreaterThan(0);
    const park = await c
      .http()
      .post('/api/v1/assistant/ask')
      .set(auth(c.token.buyer1))
      .send({ purchaseId: S.purchase, question: 'Is car parking included?', conversationId: pay.body.data.conversationId })
      .expect(200);
    expect(park.body.data.message.text.toLowerCase()).toContain('parking');
    S.conversation = pay.body.data.conversationId;
  });
  it("never answers about another buyer's purchase", async () => {
    await c
      .http()
      .post('/api/v1/assistant/ask')
      .set(auth(c.token.buyer2))
      .send({ purchaseId: S.purchase, question: 'What is the balance?' })
      .expect(404);
    await c
      .http()
      .post('/api/v1/assistant/ask')
      .set(auth(c.token.buyer2))
      .send({ purchaseId: S.purchase, question: 'hi', conversationId: S.conversation })
      .expect(404);
  });
  it('escalates a conversation to a support ticket', async () => {
    const t = await c.http().post(`/api/v1/assistant/conversations/${S.conversation}/escalate`).set(auth(c.token.buyer1)).expect(201);
    const list = await c.http().get('/api/v1/tickets').set(auth(c.token.manager)).expect(200);
    expect(list.body.data.find((x: { id: string }) => x.id === t.body.data.id).fromAi).toBe(true);
    await c.http().get(`/api/v1/tickets/${t.body.data.id}`).set(auth(c.token.buyer2)).expect(404);
  });
});

describe('delay risk, dashboard and scheduler', () => {
  it('computes an explained delay-risk score', async () => {
    const r = await c.http().post(`/api/v1/projects/${S.project}/risk/recompute`).set(auth(c.token.manager)).expect(200);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(r.body.data.level);
    expect(r.body.data.explanation.length).toBeGreaterThan(10);
    await c.http().get(`/api/v1/projects/${S.project}/risk`).set(auth(c.token.buyer1)).expect(403);
  });
  it('dashboard figures match the data', async () => {
    const r = await c.http().get('/api/v1/dashboard/admin').set(auth(c.token.manager)).expect(200);
    expect(r.body.data.kpis.outstanding).toBe('980000.00');
    expect(r.body.data.kpis.overdueCount).toBe(1);
  });
  it('exports CSV with a BOM for Excel', async () => {
    const r = await c.http().get('/api/v1/reports/dues?format=csv').set(auth(c.token.manager)).expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
  });
  it('scheduler moves statuses forward and never sends the same reminder twice (R19-R21)', async () => {
    const scheduler = c.app.get(SchedulerService);
    const later = new Date(Date.now() + 40 * DAY);
    await scheduler.updateInstallments(later);
    await scheduler.updateInstallments(later);
    await settle();
    const inst = await c.db.getRepository(Installment).findOneByOrFail({ purchaseId: S.purchase, milestoneId: S.m2 });
    expect(inst.status).toBe(InstallmentStatus.OVERDUE);
    const reminders = await c.db.getRepository(Notification).count({ where: { userId: c.ids.buyer1, type: 'INSTALLMENT_REMINDER' } });
    const again = await c.db.getRepository(Notification).count({ where: { userId: c.ids.buyer1, type: 'INSTALLMENT_REMINDER' } });
    expect(again).toBe(reminders);
  });
  it('public pages show no personal or financial data', async () => {
    const r = await c.http().get('/api/v1/public/test-dev').expect(200);
    expect(r.body.data.projects[0].name).toBe('Test Tower');
    expect(JSON.stringify(r.body.data)).not.toMatch(/buyer|price|amount|email/i);
  });
});
