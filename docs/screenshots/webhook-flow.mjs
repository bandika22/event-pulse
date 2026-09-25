// Phase 6 check: the third channel (webhook) works through the unchanged Angular frontend; produces screenshots 09-10.
// Needs the same services as demo-flow.mjs on a FRESH database (the local stub on :4010 acts as the webhook receiver).
// Run from a scratch dir with `npm install playwright@1.63.0`, then: node webhook-flow.mjs <output-dir>  (APP_URL overrides :4200)
import { chromium } from 'playwright';

const OUT = process.argv[2];
const APP = process.env.APP_URL ?? 'http://localhost:4200';
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const check = (cond, msg) => { if (!cond) throw new Error(`CHECK FAILED: ${msg}`); console.log(`ok - ${msg}`); };

const startedAt = new Date().toISOString(); // the stub keeps messages in memory across runs; only count this run's
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
async function login(email, password) {
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

// The worker ticks every 5s by default: poll the admin API until no delivery is still pending, instead of a fixed sleep.
async function waitForDeliveriesSettled(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await (await page.request.get(`${APP}/api/admin/deliveries`)).json();
    if (list.length && list.every((d) => d.status === 'sent' || d.status === 'failed')) return;
    await page.waitForTimeout(500);
  }
  throw new Error('deliveries did not settle in time');
}

await login('alice@example.com', 'alice123');
await page.waitForURL('**/alerts');
const options = await page.locator('select[name=channelType] option').allInnerTexts();
check(JSON.stringify(options) === '["Email","Slack","Webhook"]', `channel dropdown lists the new channel: ${options.join(', ')}`);

await page.locator('select[name=channelType]').selectOption({ label: 'Webhook' });
check(await page.getByLabel('Endpoint URL').count() === 1, 'webhook form shows "Endpoint URL" from configFields');
check(await page.getByLabel('Signing secret (optional)').count() === 1, 'webhook form shows the optional secret field');
check(!(await page.getByLabel('Signing secret (optional)').evaluate((el) => el.required)), 'secret input is not required');
await page.getByLabel('Label', { exact: true }).fill('Ops webhook');
await page.getByLabel('Endpoint URL').fill('http://localhost:4010/hook/ops');
await page.getByLabel('Signing secret (optional)').fill('demo-secret');
await shot(page, '09-webhook-destination-form');
await page.getByRole('button', { name: 'Add destination' }).click();
await page.getByRole('cell', { name: 'Ops webhook', exact: true }).waitFor();
check(await page.getByText('demo-secret').count() === 0 && await page.getByText('••••••').count() === 1, 'secret is fully masked in the destination list');

await page.getByLabel('Name').fill('Quakes to ops');
await page.getByLabel('Minimum magnitude').fill('6');
await page.getByLabel('Ops webhook (Webhook)').check();
await page.getByRole('button', { name: 'Create alert' }).click();
await page.getByRole('cell', { name: 'Quakes to ops' }).waitFor();

await page.getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/login');
await login('admin@example.com', 'admin123');
await page.waitForURL('**/admin');
await page.getByRole('button', { name: 'Events' }).click();
await page.getByLabel('Magnitude').fill('6.9');
await page.getByRole('button', { name: 'Inject' }).click();
await page.getByText(/passed baseline, 1 notification/).waitFor();
await waitForDeliveriesSettled();
await page.getByRole('button', { name: 'Deliveries' }).click();
await page.getByRole('button', { name: 'Refresh' }).click();
await page.getByRole('cell', { name: 'webhook', exact: true }).waitFor();
const row = (await page.locator('tbody tr').allInnerTexts())[0];
check(/sent\s+webhook\s+Ops webhook/.test(row), `delivery log: ${row.replace(/\s+/g, ' ').trim()}`);
await shot(page, '10-webhook-delivery');

const msgs = await (await fetch('http://localhost:4010/messages')).json();
const ops = msgs.filter((m) => m.hook === 'ops' && m.receivedAt >= startedAt);
check(ops.length === 1 && ops[0].body.type === 'event-pulse.notification' && ops[0].body.title === 'M 6.9 - Demo Trench', 'receiver got the JSON payload');

await browser.close();
console.log('WEBHOOK FLOW PASSED');
