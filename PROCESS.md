# Process Log

Entries are added only when a Claude proposal is rejected or modified, a failing test forces a logic fix, or an assumption treated as fact is corrected. Prompts behind each entry are in `PROMPTS.md`.

## 2026-09-25 14:13 — R4 validated by demonstration, not description

- **Proposed:** Claude's brief analysis listed R4 ("make it flexible enough that we can add more channels later") only as a requirement, with its meaning noted as ambiguous. It gave no way to verify it.
- **Found:** User pointed out that R4 is the one requirement in the brief that can be demonstrated concretely, not just described.
- **Decided:** The plan includes an explicit R4 validation step: build the channel layer as an abstraction with email and Slack, then add a third channel later in a separate commit as the test. Claude's two refinements were accepted: (a) measure the diff, since only new files plus a registration line should change and any edit to alert logic, dispatch, or existing channels is a logged finding; (b) choose a structurally different third channel (e.g. generic webhook or SMS), not a near-copy.
- **Why:** The third-channel commit and its diff are evidence for R4. A statement in an architecture doc is not.

## 2026-09-25 14:17 — Project decisions live in the repo, not AI memory

- **Proposed:** Claude saved the R4 decision to its own out-of-repo memory.
- **Found:** User rejected this. Reviewers can't see that memory, so the evidence trail would be incomplete.
- **Decided:** The decision was moved into this file and the memory entry deleted. `CLAUDE.md` now states the repo is the only source of truth for decisions, context, state, validation results, and findings.
- **Why:** The assignment grades the visible process. Anything outside the repo doesn't count as evidence.

## 2026-09-25 15:20 — No separate product-decisions file; Phase 6 tightened

- **Proposed:** Claude's `PLAN.md` draft had Phase 1 produce a new `docs/decisions.md`. Its Phase 6 put the third-channel diff-stat "in `PROCESS.md` or `docs/`" and left both agreed R4 details implicit.
- **Found:** User rejected the extra file, since `PLAN.md` already holds product decisions. Asked to check Phase 6, Claude found it only partly captured the agreed details: the diff rule was in AC9 but not in the phase itself, "not a near-copy" wasn't stated, and logging a routine diff-stat in `PROCESS.md` would break that file's scope.
- **Decided:** Phase 1 records decisions in `PLAN.md`. The file set stays at `CLAUDE.md`, `PROMPTS.md`, `PROCESS.md`, `PLAN.md`. Phase 6 now states the channel-choice and diff rules explicitly. The diff-stat goes in the commit message and `PLAN.md`, and only out-of-bounds edits go to `PROCESS.md`.
- **Why:** Fewer files with clear scopes. The R4 evidence plan shouldn't depend on reading AC9 and a past conversation together.

## 2026-09-25 15:28 — Architecture folded into PLAN.md

- **Proposed:** `PLAN.md` had Phase 3 produce a separate `docs/architecture.md`.
- **Found:** User clarified the four-file rule covers the process/narrative layer only. Research artifacts (`docs/data-sources.md`, `docs/screenshots/`, `fixtures/`) stay. A separate architecture doc would duplicate the plan.
- **Decided:** Architecture goes in `PLAN.md`'s Phase 3 section. A separate file only if the design outgrows a short section, and only after Claude explains why and the user agrees.
- **Why:** Keep design decisions in one place unless the size actually forces a split.

## 2026-09-25 16:28 — Phase 1 review: alert edit/pause moved to nice-to-have

- **Proposed:** Claude's Phase 1 proposals included D22: users can edit, pause, and delete their own alerts, justified as "expected and cheap". They also presented D2 (importance rules) and D4 (which source is real) as regular decisions.
- **Found:** User rejected D22's inclusion: it isn't in the brief, maps to no AC, and "cheap" isn't a justification. D2 and D4 rest on unverified claims about external sources.
- **Decided:** Edit/pause/delete moved to a nice-to-have list, not built by default. D2 and D4 marked provisional until Phase 2. Other proposals accepted, including the AC10 rewording and D18 (no backfill).
- **Why:** Scope is set by the brief and the ACs, not by what's easy to add. Decisions based on unverified facts shouldn't read as settled.

## 2026-09-25 16:47 — USGS as the only real source; GDACS dropped

- **Proposed:** Claude recommended GDACS as the live disaster source (USGS as fallback) and recommended committing GDACS payloads "with attribution". It described GDACS's terms as "don't forbid reuse, but don't grant it", and in this file as "at least not-prohibited" reuse.
- **Found:** User challenged the inconsistent descriptions of GDACS's terms and asked for the actual line. There was none to quote: Claude had only a fetch tool's model-written summary of the page, not its raw text. The summary said the terms don't address reuse, and Claude had turned that silence into a lean toward "not prohibited" and a recommendation to commit.
- **Decided (user):** Stop testing other sources. USGS is the one real source (enough for AC8). GDACS dropped from D4 and its fixtures removed. Market and news synthetic from the start. D2, D4, D8 updated in `PLAN.md`; GDACS terms marked unverified in `docs/data-sources.md`.
- **Why:** USGS is live, verified, and public domain, so it satisfies AC8 without resting on any unverified terms. More source research wouldn't move any AC forward.

## 2026-09-25 17:01 — better-sqlite3 instead of node:sqlite

- **Proposed:** Claude proposed Node's built-in `node:sqlite` to avoid a native dependency, after verifying it works on Node 24.14 but emits an `ExperimentalWarning`.
- **Found:** User preferred a stable library and asked what switching would cost before Phase 4 builds on it. Claude test-installed `better-sqlite3` on this machine: v13.0.3 installed from a prebuilt binary in ~3s, no compile step, and unique violations raise the specific `SQLITE_CONSTRAINT_UNIQUE` (vs. `node:sqlite`'s generic `ERR_SQLITE_ERROR`).
- **Decided (user):** Use `better-sqlite3`. Cost: a one-line change in `PLAN.md`, since no code existed yet.
- **Why:** The feared downside of a native module (a build toolchain on Windows) didn't materialize, so there was no reason to accept an experimental API. The specific error code also makes the dedup path (AC10) cleaner to detect.

## 2026-09-25 17:35 — Phase 4: design assumptions corrected during the build

- **Proposed:** Phase 3's schema (reviewed and committed) kept delivery state in one `deliveries` row per destination. Phase 3 also assumed `better-sqlite3` installs from a prebuilt binary via its install script, and the 17:01 entry above justified it partly by its specific unique-violation error code for dedup.
- **Found:** (1) One row per delivery keeps only the latest attempt, but AC11 says *every* attempt is recorded. (2) npm 11 blocked `better-sqlite3`'s install script (`node-gyp rebuild`) yet the module loaded anyway. Inspection showed v13 ships prebuilt binaries inside the package, so the script isn't how the binary arrives. (3) The dedup code uses `INSERT OR IGNORE` and checks `changes`, so the unique-violation error code is never used; that part of the 17:01 rationale doesn't hold.
- **Decided:** Added a `delivery_attempts` table (tested; visible per delivery in the admin API). Denied both blocked install scripts explicitly in `backend/package.json` so clones never attempt a native build. The `better-sqlite3` choice stands on stability alone.
- **Why:** The schema gap would have failed AC11 silently. The install behaviour would have differed across machines if left to npm's defaults.

## 2026-09-25 17:51 — Phase 5: Angular version and a guard bug

- **Proposed:** Claude started scaffolding with the current Angular CLI (22.2.0), assuming it runs on the machine's Node. Claude's first route guards called `inject(Router)` after `await auth.load()`.
- **Found:** Angular CLI 22.x (all releases) requires Node ≥ 24.15.0; the machine has 24.14.1, and the CLI exits. Angular 21.2.24 supports it. Separately, the first browser run of the demo flow failed: visiting `/alerts` logged out landed on `/` instead of `/login`, because `inject()` after `await` is outside the injection context and throws inside the guard. The build and type checks passed with the bug.
- **Decided:** User chose Angular 21 over upgrading Node (recorded in `PLAN.md` Known constraints). Guards now resolve `Auth` and `Router` before awaiting; the browser check passes.
- **Why:** Upgrading Node would change the user's machine for a one-major-version gain. The guard bug shows why Phase 5's check runs the flow in a real browser, not just the build.

## 2026-09-25 17:59 — Demo credentials: dev-only note and a README that didn't exist

- **Proposed:** Claude's login page listed the demo credentials with no caveat. Claude's code referred readers to a README for them (`backend/src/seed.ts` comment; the startup log line "created demo users (see README)").
- **Found:** User asked for an explicit dev-only statement and for confirmation that the credentials are in the README. No root README existed (it was planned for Phase 7), so both references pointed to nothing. Nothing in the code prevents seeding or showing the accounts in a production build either.
- **Decided:** The login page now says "Local development only" and points to the README, without claiming production behaviour the code doesn't enforce. A working root `README.md` documents the accounts and lists what must change before any real deployment (no seeding, no credentials on the page, a real `SESSION_SECRET`, HTTPS + `secure` cookie, Slack prefix allowlist). Each item was checked against the code. Phase 7 extends this README rather than creating it.
- **Why:** A pointer to documentation that doesn't exist is a quiet false claim. The page text should describe what's true of the code, not what a production setup would ideally do.

## 2026-09-25 18:34 — Phase 6: what the third channel exposed

- **Proposed:** Claude's Phase 3 design claimed a new channel needs only a new file plus a registration entry (AC9), with generic masking of `sensitive` config fields in `app.ts`. Claude's first webhook signature test checked the header against `signature()`, the function under test.
- **Found:** (1) The webhook needs its own URL allowlist (SSRF), and channel settings live in the shared `config.ts`, so that file had to change (+2 lines). Claude chose to follow the existing pattern and report it, rather than hide the setting inside the channel file to keep the diff clean. (2) The browser check found the webhook's signing secret shown in full in the destinations list: `maskConfig` kept the first 24 characters of sensitive values, which only worked for Slack URLs. The API test only asserted the value ended in "…", so it passed with the leak. (3) A mutation (signing without the timestamp) passed the signature test, because the test was self-confirming.
- **Decided:** Kept the `config.ts` edit and recorded AC9 as "partly holds" in `PLAN.md`, with the diff table. Fixed masking to origin-only for URLs and fully hidden otherwise, with exact-value tests, in a separate commit. The signature test now computes the HMAC independently; the mutation fails it. Phase 5 screenshots were regenerated.
- **Why:** AC9's value is in reporting what the new channel actually needed. The masking bug was a security defect that the two existing channels couldn't reveal.

## 2026-09-25 18:52 — Phase 7: evidence scripts depended on an undocumented setting

- **Proposed:** Claude's browser scripts (`docs/screenshots/demo-flow.mjs`, `webhook-flow.mjs`) waited a fixed 3 s for deliveries, and the webhook script counted every message the stub had received.
- **Found:** In the fresh-clone check, run with README defaults, "3 sent" failed: deliveries were still `pending` after 3 s. Every earlier run had set `WORKER_TICK_MS=1000`, which the README doesn't mention; the default tick is 5 s. Querying the API showed all three sent ~3.5 s after creation, so the app was right and the script was wrong. The webhook script also failed on a reused stub, whose in-memory log held a message from an earlier run.
- **Decided:** Both scripts poll the admin API until every delivery is `sent` or `failed` (30 s limit). The webhook script counts only messages received after it started. Both pass against the clone with README defaults.
- **Why:** Evidence that only passes with an undocumented setting isn't reproducible for a reviewer following the README.
