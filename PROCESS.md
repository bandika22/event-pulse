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
