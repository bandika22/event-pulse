// Reproduces docs/screenshots/*.png and checks the Phase 5 demo flow in a real browser.
// Needs: Mailpit (docker compose up -d), Slack stub (npm run slack-stub), backend (npm start) on a FRESH database,
// Angular dev server (npx ng serve) on :4200, and Microsoft Edge installed.
// Run from a scratch dir with `npm install playwright@1.63.0`, then: node demo-flow.mjs <output-dir>
import { chromium } from 'playwright';

const OUT = process.argv[2];
const APP = 'http://localhost:4200';
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const check = (cond, msg) => { if (!cond) throw new Error(`CHECK FAILED: ${msg}`); console.log(`ok - ${msg}`); };

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

async function login(email, password) {
  await page.goto(`${APP}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

// --- user flow ---
await page.goto(`${APP}/alerts`);
await page.waitForURL('**/login');
check(true, 'anonymous visit to /alerts redirects to /login');
await shot(page, '01-login');

await login('alice@example.com', 'alice123');
await page.waitForURL('**/alerts');

async function addDestination(channel, label, fieldLabel, value) {
  await page.locator('select[name=channelType]').selectOption({ label: channel });
  await page.getByLabel('Label', { exact: true }).fill(label);
  await page.getByLabel(fieldLabel).fill(value);
  await page.getByRole('button', { name: 'Add destination' }).click();
  await page.getByRole('cell', { name: label, exact: true }).waitFor();
}
await addDestination('Email', 'Inbox', 'Email address', 'alice@example.com');
await addDestination('Slack', '#alerts (stub)', 'Incoming webhook URL', 'http://localhost:4010/hook/alerts');
await addDestination('Slack', 'Revoked hook', 'Incoming webhook URL', 'http://localhost:4010/hook/fail-404');
check(await page.getByText('http://localhost:4010/ho…').count() === 2, 'Slack webhook URLs are masked in the list');

// Below-baseline threshold must be rejected by the backend and shown.
await page.getByLabel('Name').fill('Too sensitive');
await page.getByLabel('Minimum magnitude').fill('4');
await page.getByLabel('Inbox (Email)').check();
await page.getByRole('button', { name: 'Create alert' }).click();
await page.getByText(/below the system baseline/).waitFor();
check(true, 'alert below the M5.0 baseline is rejected with the backend message');
await shot(page, '02-alert-validation-error');

await page.getByLabel('Name').fill('Big quakes');
await page.getByLabel('Minimum magnitude').fill('6');
await page.getByLabel('#alerts (stub) (Slack)').check();
await page.getByLabel('Revoked hook (Slack)').check();
await page.getByRole('button', { name: 'Create alert' }).click();
await page.getByRole('cell', { name: 'Big quakes' }).waitFor();

await page.getByLabel('Name').fill('Wildfires');
await page.getByLabel('Category').selectOption('news');
await page.getByLabel('Keywords').fill('wildfire');
await page.getByLabel('#alerts (stub) (Slack)').check();
await page.getByRole('button', { name: 'Create alert' }).click();
await page.getByRole('cell', { name: 'Wildfires' }).waitFor();
check(true, 'user created an earthquake alert (3 destinations) and a news alert');
await shot(page, '03-my-alerts');

check(await page.getByRole('link', { name: 'Admin' }).count() === 0, 'non-admin sees no Admin link');
await page.goto(`${APP}/admin`);
await page.waitForURL('**/alerts');
check(true, 'non-admin visiting /admin is redirected');

// --- admin flow ---
await page.getByRole('button', { name: 'Log out' }).click();
await page.waitForURL('**/login');
await login('admin@example.com', 'admin123');
await page.waitForURL('**/admin');

await page.getByRole('button', { name: 'Events' }).click();
await page.getByLabel('Magnitude').fill('7.2');
await page.getByRole('button', { name: 'Inject' }).click();
await page.getByText(/passed baseline, 1 notification/).waitFor();
await page.getByLabel('Category').selectOption('news');
await page.getByRole('button', { name: 'Inject' }).click();
await page.getByText(/passed baseline, 1 notification/).waitFor();
check(true, 'admin injected an M7.2 quake and a wildfire headline, each creating 1 notification');

await page.waitForTimeout(3000); // worker ticks every 1s in this run
await page.getByRole('button', { name: 'Refresh' }).click();
await page.getByRole('cell', { name: 'M 7.2 - Demo Trench' }).first().waitFor();
await shot(page, '04-admin-events');

await page.getByRole('button', { name: 'Deliveries' }).click();
const rows = page.locator('tbody tr');
await rows.first().waitFor();
const statuses = (await rows.allInnerTexts()).map((t) => t.split('\t').slice(1, 4).join(' | '));
console.log(statuses.join('\n'));
check(statuses.length === 4, '4 deliveries (3 for the quake alert, 1 for the news alert)');
check(statuses.filter((s) => s.startsWith('sent')).length === 3, '3 sent');
check(statuses.some((s) => s.startsWith('failed') && s.includes('Revoked hook')), 'the fail-404 hook is failed');
check(await page.getByText('HTTP 404: no_service').count() === 1, 'failure reason is shown');
await shot(page, '05-admin-deliveries');

await page.getByRole('button', { name: 'Users & alerts' }).click();
await page.getByRole('heading', { name: 'All alerts' }).waitFor();
await shot(page, '06-admin-users-alerts');

await page.getByRole('button', { name: 'Sources' }).click();
await page.getByRole('cell', { name: 'usgs' }).waitFor();
check(await page.getByText('USGS is the only live source').count() === 1, 'sources tab shows USGS status');
await shot(page, '07-admin-sources');

await page.goto('http://localhost:8025/');
await page.getByText('[Event Pulse] M 7.2 - Demo Trench').first().waitFor();
check(true, 'the quake email is in Mailpit');
await shot(page, '08-mailpit-inbox');

await browser.close();
console.log('DEMO FLOW PASSED');
