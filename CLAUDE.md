# CLAUDE.md

## Prompt log

Before acting on any prompt from the user, append it to `PROMPTS.md` at the end with:

- a timestamp (`YYYY-MM-DD HH:MM ±TZ`), taken from the clock, never guessed
- a one-line note on the prompt's purpose
- the user's exact wording, verbatim — never paraphrase, trim, or fix typos

This includes short confirmations and approvals (e.g. "yes, commit", "approved"). Only slash commands (e.g. `/login`) are not logged.

## Repo is the only source of truth

Never rely on Claude's internal or session memory to persist project decisions, context, or state. Anything that matters (decisions, validation results, findings) must be written into repo files.

## PROCESS.md

Add an entry only when:
- Claude proposes something the user rejects or modifies,
- a test fails and Claude fixes the logic, or
- an assumption Claude treated as fact turns out wrong and gets corrected.

Don't log routine exchanges. Format each entry as:
**Proposed** → **Found** → **Decided** → **Why**

## Known constraints

- **Frontend: Angular.** Fixed constraint, not an open decision. Don't revisit it during design.

## Git workflow

Commit directly to `main` with frequent, meaningful commits. Use a separate branch only when deliberately trying an approach we already suspect we'll reject. Name it clearly (e.g. `experiment/...`) and record its existence and reason in `PROCESS.md`.
