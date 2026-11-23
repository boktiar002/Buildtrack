/** Company settings: only admins can change them, receipt prefixes stay unique, and every change is audited. */
import { auth, bootstrap, Ctx } from './helpers';

let c: Ctx;
beforeAll(async () => {
  c = await bootstrap();
});
afterAll(async () => {
  await c.app.close();
});

describe('company settings', () => {
  it('lets an admin read and change the settings, and records the change in the audit log', async () => {
    const before = await c.http().get('/api/v1/organization').set(auth(c.token.admin)).expect(200);
    expect(before.body.data).toMatchObject({ receiptPrefix: 'TST', milestoneGraceDays: 15 });

    const r = await c
      .http()
      .patch('/api/v1/organization')
      .set(auth(c.token.admin))
      .send({ milestoneGraceDays: 10, aiMonthlyBudgetUsd: 7.5, primaryColor: '#123456' })
      .expect(200);
    expect(r.body.data).toMatchObject({ milestoneGraceDays: 10, aiMonthlyBudgetUsd: '7.50', primaryColor: '#123456' });

    const [log] = await c.db.query(`SELECT "oldValue", "newValue" FROM audit_logs WHERE action = 'SETTINGS_CHANGED'`);
    expect(log.oldValue).toMatchObject({ milestoneGraceDays: 15 });
    expect(log.newValue).toMatchObject({ milestoneGraceDays: 10, aiMonthlyBudgetUsd: '7.50' });
  });

  it('refuses a receipt prefix that another company already uses', async () => {
    // The other test company was created with the default prefix RCP.
    await c.http().patch('/api/v1/organization').set(auth(c.token.admin)).send({ receiptPrefix: 'RCP' }).expect(409);
  });

  it('rejects a badly formed prefix and colour', async () => {
    await c.http().patch('/api/v1/organization').set(auth(c.token.admin)).send({ receiptPrefix: 'ab1', accentColor: 'gold' }).expect(400);
  });

  it('is admin-only', async () => {
    await c.http().patch('/api/v1/organization').set(auth(c.token.manager)).send({ milestoneGraceDays: 1 }).expect(403);
  });
});
