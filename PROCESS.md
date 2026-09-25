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
