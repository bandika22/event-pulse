# CLAUDE.md

## Prompt log

Before acting on any substantive prompt from the user, append it to `PROMPTS.md` at the end with:

- a timestamp (`YYYY-MM-DD HH:MM ±TZ`)
- a one-line note on the prompt's purpose
- the user's exact wording, verbatim — never paraphrase, trim, or fix typos

Skip trivial messages (e.g. "yes", "thanks", slash commands).

## Repo is the only source of truth

Never rely on Claude's internal or session memory to persist project decisions, context, or state. Anything that matters (decisions, validation results, findings) must be written into repo files.

## PROCESS.md

Add an entry only when:
- Claude proposes something the user rejects or modifies,
- a test fails and Claude fixes the logic, or
- an assumption Claude treated as fact turns out wrong and gets corrected.

Don't log routine exchanges. Format each entry as:
**Proposed** → **Found** → **Decided** → **Why**
