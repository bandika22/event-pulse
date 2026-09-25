# Event Pulse

Users set up alerts and get notified by email, Slack or a generic signed webhook when something important happens: earthquakes (live), market moves and news (synthetic demo data). Admins get a view of users, alerts, events, deliveries and source health.

This repo is also the record of how it was built from a one-paragraph brief (`docs/brief.pdf`): see [Process and evidence](#process-and-evidence).

## What's real and what's demo data

| Category | Source | Real? |
|---|---|---|
| Earthquakes | USGS GeoJSON feed, polled every 2 minutes | **Live** (public domain, credit: U.S. Geological Survey) |
| Market moves | `fixtures/synthetic/market.json` or admin "Inject test event" | Synthetic |
| News | `fixtures/synthetic/news.json` or admin "Inject test event" | Synthetic |

Synthetic events are labeled as such in the admin view and in every notification. Why: see [`docs/data-sources.md`](docs/data-sources.md).

## How it works

One Node/TypeScript backend process polls USGS, normalizes events, applies a per-category importance baseline (earthquakes M ≥ 5.0, market moves ≥ 2%, news: keyword match), matches events against users' alerts, and queues one delivery per destination. A worker sends deliveries through a channel registry (email, Slack, webhook) with retry and backoff, and records every attempt. Each alert notifies at most once per source event; revised events can notify alerts they newly match; alerts never fire for events seen before they were created. The Angular app covers alert and destination setup and the admin view. Design details: `PLAN.md` (decisions D1–D21 and the Phase 3 architecture).

## Run locally

Requires Node 24 (tested on 24.14.1) and Docker. Uses ports 1025, 8025, 3000, 4010 and 4200.

```sh
docker compose up -d                              # Mailpit: SMTP :1025, inbox UI http://localhost:8025

# terminal 1
cd backend && npm install && npm run slack-stub   # fake Slack/webhook receiver on :4010

# terminal 2
cd backend && npm start                           # API on :3000 (creates backend/data/event-pulse.db)

# terminal 3
cd frontend && npm install && npm start           # app on http://localhost:4200
```

Log in with a [demo account](#demo-accounts-local-development-only). In the app, a Slack destination can use `http://localhost:4010/hook/<any-name>` (messages are listed at `http://localhost:4010/messages`), or `http://localhost:4010/hook/fail-404` to see a failed delivery. A webhook destination can use the same stub URLs; real endpoints must be allowed with `WEBHOOK_ALLOWED_PREFIXES`. As admin, use **Events → Inject test event** or **Replay synthetic fixtures** to trigger notifications on demand.

Tests: `cd backend && npm test` (49 tests) and `npm run typecheck`.

**Settings** (environment variables, backend): `PORT` (3000), `DB_PATH` (`data/event-pulse.db`), `SESSION_SECRET`, `SMTP_HOST`/`SMTP_PORT` (localhost:1025), `MAIL_FROM`, `SLACK_ALLOWED_PREFIXES`, `WEBHOOK_ALLOWED_PREFIXES`, `USGS_ENABLED` (true), `USGS_FEED_URL`, `USGS_POLL_MS` (120000), `WORKER_TICK_MS` (5000). The frontend dev server proxies `/api` to `localhost:3000` (`frontend/proxy.conf.json`).

## Demo accounts (local development only)

On first start, the backend seeds two accounts and the login page lists them:

| Role | Email | Password |
|---|---|---|
| User | `alice@example.com` | `alice123` |
| Admin | `admin@example.com` | `admin123` |

**These are for local demos only and this setup is not production-ready.** As built, nothing stops a production build from seeding these accounts or showing them on the login page. Before any real deployment:

- **Don't seed demo accounts.** Seeding runs unconditionally in `backend/src/server.ts`; it would need to be removed or put behind a flag, with real account creation in its place.
- **Remove the credentials from the login page** (`frontend/src/app/pages/login.ts`).
- **Set `SESSION_SECRET`.** The default (`dev-only-secret-change-me`) is public in this repo, so anyone could forge session cookies.
- **Serve over HTTPS and mark the session cookie `secure`** (currently `httpOnly` + `SameSite=Lax` only).
- **Restrict `SLACK_ALLOWED_PREFIXES`** to `https://hooks.slack.com/`; the default also allows the local stub on `http://localhost:4010/`.
- **Set `WEBHOOK_ALLOWED_PREFIXES`** to the real endpoints you trust; the default allows only the local stub.

## Known gaps

**Not verified against the real thing**
- **Slack:** only the error path was tested against real Slack (a made-up webhook URL returns `404 no_team`). Successful delivery was tested against the local stub, never a real workspace. How Slack signals rate limiting is undocumented; 429 is retried by assumption.
- **Email:** tested only against Mailpit, not a real SMTP provider.
- **USGS:** whether an event's `id` can change (its `ids` field suggests it can) is unverified. If it does, one quake could notify twice.

**Product scope (decided, see `PLAN.md`)**
- Market and news are synthetic. News importance is the weakest rule: keyword match only.
- Users can't edit, pause or delete their alerts (only an admin can disable one). No geographic filter, no digests or quiet hours.
- One event matching two alerts of the same user sends two notifications (D19). Dedup is per source event; the same story from two sources would notify twice.

**Engineering**
- Channel settings live in the shared `backend/src/config.ts`, so a channel that needs its own setting has to edit that file (Phase 6 finding).
- Sensitive destination fields are typed in plain text in the form; they're masked only when listed.
- No frontend unit tests: the frontend is checked by browser scripts (`docs/screenshots/*.mjs`), which need Microsoft Edge and a fresh database.
- The delivery log refreshes on demand, not live. The alert form keeps its filter values after creating an alert.
- Single process with SQLite, sized for a demo. No login rate limiting; no CSRF tokens (relies on `SameSite=Lax`).

## Process and evidence

| File | What it holds |
|---|---|
| [`PLAN.md`](PLAN.md) | Acceptance criteria (brief vs. our own), decisions D1–D21, the phases, each phase's result with evidence, and the retrospective |
| [`PROCESS.md`](PROCESS.md) | Every AI proposal that was rejected or changed, every failed test that forced a fix, every assumption corrected |
| [`PROMPTS.md`](PROMPTS.md) | The prompts given, verbatim, with timestamps |
| [`CLAUDE.md`](CLAUDE.md) | The working rules given to the AI agent |
| [`docs/data-sources.md`](docs/data-sources.md) | Phase 2 research: every candidate source, tested with real requests |
| [`docs/screenshots/`](docs/screenshots/) | Screenshots and the browser scripts that reproduce them |
| `fixtures/` | Recorded USGS responses and hand-written synthetic events |

Git history has one or more commits per phase. The third-channel test (AC9) is commit `87363cb`; `git show --stat 87363cb` shows its full footprint.
