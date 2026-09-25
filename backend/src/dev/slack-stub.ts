/**
 * Local stand-in for Slack incoming webhooks (AC12), so the demo needs no Slack workspace.
 * POST /hook/<name> records the message and answers like Slack ("ok").
 * Special names simulate Slack failures for the AC11 demo:
 *   /hook/fail-404 -> 404 "no_service" (permanent)   /hook/fail-500 -> 500 (retryable)
 * GET /messages lists what was received.
 */
import express from 'express';

const port = Number(process.env.SLACK_STUB_PORT ?? 4010);
const received: { hook: string; receivedAt: string; body: unknown }[] = [];
const app = express();
app.use(express.json());

app.post('/hook/:name', (req, res) => {
  const hook = req.params.name;
  if (hook === 'fail-404') { res.status(404).type('text').send('no_service'); return; }
  if (hook === 'fail-500') { res.status(500).type('text').send('internal_error'); return; }
  received.push({ hook, receivedAt: new Date().toISOString(), body: req.body });
  console.log(`[slack-stub] ${hook}: ${JSON.stringify(req.body)}`);
  res.type('text').send('ok');
});

app.get('/messages', (_req, res) => { res.json(received); });

app.listen(port, () => console.log(`[slack-stub] listening on http://localhost:${port} (webhook URL: http://localhost:${port}/hook/<name>)`));
