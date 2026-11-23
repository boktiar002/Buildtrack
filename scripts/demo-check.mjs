/**
 * BuildTrack end-to-end demo check.
 * Drives a real browser through the course demo story and fails on any
 * browser error, server error or missing step.
 *
 * Needs: API + web running (pnpm dev or start), demo data loaded (pnpm db:seed),
 * and Playwright's browser:  npx playwright install chromium
 * Run:   node scripts/demo-check.mjs [http://localhost:3000] [screenshot-folder]
 */
import { mkdirSync } from 'fs';
import { createRequire } from 'module';

// Resolve sharp from the API package and Playwright from wherever it is installed.
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:3000';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PASSWORD = 'Demo@12345';
const problems = [];
let step = 0;

async function photo(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="100%" height="100%" fill="hsl(${hue},40%,75%)"/>
  <rect x="400" y="300" width="800" height="700" fill="#6b7480"/><rect x="400" y="250" width="800" height="50" fill="#c8a24a"/>
  <text x="60" y="110" font-size="72" font-family="Arial" fill="#fff">${label}</text></svg>`;
  return { name: `${label.replace(/\W+/g, '-')}.jpg`, mimeType: 'image/jpeg', buffer: await sharp(Buffer.from(svg)).jpeg().toBuffer() };
}

async function login(browser, email, viewport = { width: 1366, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${email}] page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && problems.push(`[${email}] console: ${m.text().slice(0, 200)}`));
  page.on('response', (r) => r.status() >= 500 && problems.push(`[${email}] HTTP ${r.status()} ${r.url()}`));
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  return { ctx, page };
}

async function check(name, fn, page) {
  step++;
  process.stdout.write(`${step}. ${name} ... `);
  await fn();
  if (SHOTS && page) await page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-${name.replace(/\W+/g, '-').toLowerCase()}.png`, fullPage: true });
  console.log('ok');
}

const browser = await chromium.launch();
try {
  // 1. Engineer posts photos from a phone; AI suggests the stage; engineer confirms.
  const eng = await login(browser, 'engineer@pipra.test', { width: 390, height: 844 });
  await eng.page.goto(`${BASE}/site`);
  await eng.page.getByRole('link', { name: 'Post an update' }).last().click();
  await check('engineer uploads photos and gets an AI suggestion', async () => {
    await eng.page.waitForSelector('text=Photos (0/8)');
    await eng.page.locator('input[type=file][multiple]').setInputFiles([await photo('Floor 5 slab north', 200), await photo('Floor 5 slab south', 215)]);
    await eng.page.fill('input[placeholder^="e.g."]', 'Floor 5 slab casting finished');
    await eng.page.getByRole('button', { name: /Upload and get AI suggestion/ }).click();
    await eng.page.waitForSelector('text=Check and confirm', { timeout: 60000 });
  }, eng.page);
  await check('engineer confirms the stage at 100% and sends for review', async () => {
    const stage = eng.page.getByLabel('Stage shown in the photos');
    const value = await stage.locator('option', { hasText: 'Floor 5 slab' }).getAttribute('value');
    await stage.selectOption(value);
    await eng.page.locator('#progress').fill('100');
    await eng.page.getByRole('button', { name: /send/i }).click();
    await eng.page.waitForSelector('text=Sent for review', { timeout: 30000 });
  }, eng.page);
  await eng.ctx.close();

  // 2. Manager reviews the AI draft and publishes; completes Floor 6 slab.
  const mgr = await login(browser, 'manager@pipra.test');
  await check('manager publishes the AI-drafted update', async () => {
    await mgr.page.goto(`${BASE}/admin/reviews`);
    const card = mgr.page.locator('section', { hasText: 'Floor 5 slab casting finished' });
    await card.waitFor();
    await card.getByRole('button', { name: 'Publish to buyers' }).click();
    await mgr.page.waitForSelector('text=Published. Buyers have been notified.');
  }, mgr.page);
  await check('manager marks Floor 6 slab complete; linked installments become due', async () => {
    await mgr.page.goto(`${BASE}/admin/projects`);
    await mgr.page.getByRole('link', { name: /Pipra Heights/ }).click();
    const row = mgr.page.locator('tr', { hasText: 'Floor 6 slab' });
    await row.getByRole('button', { name: 'Update' }).click();
    await mgr.page.locator('#pv').fill('100');
    await mgr.page.getByRole('button', { name: 'Save progress' }).click();
    await mgr.page.waitForSelector('text=Linked installments are now due');
  }, mgr.page);
  await check('manager records a bKash payment and a receipt is issued', async () => {
    await mgr.page.getByRole('tab', { name: 'Flats and bookings' }).click();
    await mgr.page.locator('tr', { hasText: 'Nusrat Jahan' }).first().getByRole('link').click();
    await mgr.page.getByRole('button', { name: 'Record payment' }).click();
    await mgr.page.getByLabel('Method').selectOption('BKASH');
    await mgr.page.getByLabel(/Reference/).fill('TRXDEMO001');
    await mgr.page.getByRole('button', { name: /Record payment and issue receipt/ }).click();
    await mgr.page.waitForSelector('text=/Receipt PIP-\\d{4}-\\d{6}/');
  }, mgr.page);
  await check('manager changes the handover date with a reason', async () => {
    await mgr.page.goto(`${BASE}/admin/projects`);
    await mgr.page.getByRole('link', { name: /Pipra Heights/ }).click();
    await mgr.page.getByRole('tab', { name: 'Handover date' }).click();
    const date = mgr.page.getByLabel('New expected handover date');
    const current = await date.inputValue();
    const next = new Date(new Date(current).getTime() + 30 * 86400000).toISOString().slice(0, 10);
    await date.fill(next);
    await mgr.page.getByLabel(/Reason/).fill('Lift equipment shipment from abroad arrived one month late.');
    await mgr.page.getByRole('button', { name: /Change date and notify buyers/ }).click();
    await mgr.page.waitForSelector('text=All buyers have been notified');
  }, mgr.page);
  await check('dashboard and AI insights load', async () => {
    await mgr.page.goto(`${BASE}/admin`);
    await mgr.page.waitForSelector('text=How the AI is doing');
    await mgr.page.goto(`${BASE}/admin/ai`);
    await mgr.page.waitForSelector('text=AI calls this month');
  }, mgr.page);
  await mgr.ctx.close();

  // 3. Buyer sees everything and asks the assistant.
  const buyer = await login(browser, 'buyer1@pipra.test');
  await check('buyer sees the new update, the due payment and the handover change', async () => {
    await buyer.page.goto(`${BASE}/portal`);
    // The published title is the AI-written one, so match the stage name only.
    await buyer.page.waitForSelector('text=/Latest from the site, just now/');
    await buyer.page.waitForSelector('text=/Floor 5 slab/');
    await buyer.page.waitForSelector('text=Next payment');
    await buyer.page.getByRole('link', { name: /See progress, payments and documents/ }).click();
    await buyer.page.getByRole('tab', { name: 'Handover' }).click();
    await buyer.page.waitForSelector('text=Lift equipment shipment');
  }, buyer.page);
  await check('buyer opens their receipt', async () => {
    await buyer.page.getByRole('tab', { name: 'Payments' }).click();
    await buyer.page.getByRole('link', { name: 'Receipt' }).first().click();
    await buyer.page.waitForSelector('text=Payment receipt');
  }, buyer.page);
  await check('buyer asks the AI assistant two questions', async () => {
    await buyer.page.goto(`${BASE}/portal/assistant`);
    await buyer.page.getByRole('button', { name: 'When is my next payment?' }).click();
    await buyer.page.waitForSelector('text=Your next payment is');
    await buyer.page.fill('#q', 'Is car parking included with my flat?');
    await buyer.page.press('#q', 'Enter');
    await buyer.page.waitForSelector('text=/car parking space/');
  }, buyer.page);
  await check('buyer cannot open staff pages', async () => {
    await buyer.page.goto(`${BASE}/admin`);
    await buyer.page.waitForURL((u) => u.pathname.startsWith('/portal'), { timeout: 15000 });
  });
  await buyer.ctx.close();

  // 4. Public page.
  const pub = await browser.newPage();
  await check('public website shows the project', async () => {
    await pub.goto(BASE);
    await pub.waitForSelector('text=Watch your home rise');
    await pub.getByRole('link', { name: 'See Pipra Heights' }).click();
    await pub.waitForSelector('text=Latest from the site');
  }, pub);
} catch (err) {
  console.log('FAILED');
  problems.push(String(err?.message ?? err).split('\n')[0]);
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${step} demo steps passed with no browser or server errors.`);
