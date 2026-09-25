# Event Pulse

Users set up alerts and get notified by email, Slack or a generic signed webhook when something important happens: earthquakes (live), market moves and news (synthetic demo data). Admins get a view of users, alerts, events, deliveries and source health.

How this was built (plan, decisions, corrections, prompts) is in [`PLAN.md`](PLAN.md), [`PROCESS.md`](PROCESS.md) and [`PROMPTS.md`](PROMPTS.md). *The full README is Phase 7; this is the working version.*

## What's real and what's demo data

| Category | Source | Real? |
|---|---|---|
| Earthquakes | USGS GeoJSON feed, polled every 2 minutes | **Live** (public domain, credit: U.S. Geological Survey) |
| Market moves | `fixtures/synthetic/market.json` or admin "Inject test event" | Synthetic |
| News | `fixtures/synthetic/news.json` or admin "Inject test event" | Synthetic |

Synthetic events are labeled as such in the admin view and in every notification. Why: see [`docs/data-sources.md`](docs/data-sources.md).

## Run locally

Requires Node 24 (tested on 24.14.1) and Docker.

```sh
docker compose up -d                          # Mailpit: SMTP :1025, inbox UI http://localhost:8025
cd backend && npm install
npm run slack-stub                            # terminal 1: fake Slack webhooks on :4010
npm start                                     # terminal 2: API on :3000 (creates backend/data/event-pulse.db)
cd ../frontend && npm install && npm start    # terminal 3: app on http://localhost:4200
```

In the app, a Slack destination can use `http://localhost:4010/hook/<any-name>` (messages are listed at `http://localhost:4010/messages`), or `http://localhost:4010/hook/fail-404` to see a failed delivery. A webhook destination can use the same stub URLs; real endpoints must be allowed with `WEBHOOK_ALLOWED_PREFIXES` (comma-separated URL prefixes).

Tests: `cd backend && npm test`.

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
