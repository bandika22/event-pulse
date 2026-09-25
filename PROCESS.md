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
