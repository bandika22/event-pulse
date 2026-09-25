import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { buildChannels } from './channels/index.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { startWorker } from './delivery/worker.js';
import { seedDemoUsers } from './seed.js';
import { pollUsgs } from './sources/usgs.js';

const db = openDb(config.dbPath);
if (seedDemoUsers(db)) console.log('[seed] created demo users (see README)');

const registry = buildChannels(config);
const pollUsgsNow = async () => {
  const r = await pollUsgs(db, config.usgs.feedUrl);
  console.log(`[usgs] fetched ${r.fetched}, new ${r.new}, updated ${r.updated}, notifications ${r.notifications}`);
  return r;
};

const app = createApp({
  db,
  registry,
  sessionSecret: config.sessionSecret,
  syntheticFixturesDir: fileURLToPath(new URL('../../fixtures/synthetic', import.meta.url)),
  pollUsgsNow: config.usgs.enabled ? pollUsgsNow : undefined,
});

app.listen(config.port, () => console.log(`[api] listening on http://localhost:${config.port}`));
startWorker(db, registry, config.workerTickMs);

if (config.usgs.enabled) {
  const poll = () => pollUsgsNow().catch((err) => console.error('[usgs] poll failed:', err.message));
  void poll();
  setInterval(poll, config.usgs.pollMs);
}
