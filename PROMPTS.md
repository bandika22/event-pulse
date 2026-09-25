# Prompts

## 2026-09-25 13:49 +02:00
**Purpose:** Set up CLAUDE.md with a rule to log prompts verbatim in PROMPTS.md.

```
Write a CLAUDE.md file at the project root with one rule: whenever I give you a substantive prompt, copy my exact wording verbatim into PROMPTS.md, appended at the end with a timestamp and a one-line note on the purpose of the prompt before you act on it. Do not paraphrase my wording. Keep the file short.
```

## 2026-09-25 13:56 +02:00
**Purpose:** Analyze the brief for requirements, ambiguities, unknowns, and assumptions before proposing a solution.

```
Read docs/brief.md. Do not propose a solution yet. Identify: (1) explicit requirements stated in the brief, (2) ambiguities or missing product decisions, (3) technical unknowns, (4) any assumption that would need to be made but shouldn't be made silently.
```

## 2026-09-25 14:13 +02:00
**Purpose:** Require a concrete validation step for R4 (add a third channel as a test) in the plan; don't save the analysis as a file.

```
One addition to the analysis: R4 ("channel layer has to be extensible") is the one requirement in the brief that can be demonstrated concretely, not just described. When we get to the plan, add a validation step for it: implement the channel layer as an abstraction with two concrete channels (email, Slack), then add a third channel later as a test. That's the evidence for R4, not a statement in an architecture doc.
Don't save this analysis as a separate file.
```

## 2026-09-25 14:17 +02:00
**Purpose:** Move the R4 validation decision out of Claude's memory into PROCESS.md; project decisions must live in repo files.

```
Good additions, agreed on both. One correction: don't rely on your own internal memory for this kind of decision. Since this is a real refinement to how we validate R4, log it in PROCESS.md now, in the repo, so it's visible to anyone reviewing the project. Anything that matters for the plan or the evidence trail needs to live in the repo files, not in memory outside it.
```

## 2026-09-25 14:24 +02:00
**Purpose:** Add a CLAUDE.md rule forbidding reliance on Claude's internal/session memory for any project state.

```
Add one more rule to CLAUDE.md: never rely on your own internal/session memory to persist project decisions, context, or state. Anything that matters - decisions, validation results, findings - must be written into the repo files.
```

## 2026-09-25 14:24 +02:00
**Purpose:** Define PROCESS.md's scope and entry format in CLAUDE.md.

```
Since you've already started using PROCESS.md, let's make its scope explicit in CLAUDE.md: only add an entry when you propose something I reject or modify, a test fails and you fix the logic, or an assumption you treated as fact turns out wrong and gets corrected. Don't log routine exchanges. Format each entry as: what was proposed → what was found → what was decided → why.
```

## 2026-09-25 15:11 +02:00
**Purpose:** Add CLAUDE.md rules fixing Angular as the frontend constraint and defining the git branching workflow.

```
Add two more rules to CLAUDE.md:
1. Angular is a fixed constraint for the frontend - not an open architectural decision to revisit during design. State it as a known constraint.
2. Default workflow is committing directly to main with frequent, meaningful commits. Only use a separate branch when deliberately trying an approach we already suspect we'll reject - name it clearly (e.g. experiment/...) and note its existence and reason in PROCESS.md.
```

## 2026-09-25 15:16 +02:00
**Purpose:** Write PLAN.md with phases, outputs, continuous AI-output validation, labeled acceptance criteria, and known constraints.

```
Write PLAN.md: phases, what each phase produces, and how we validate AI output -as a continuous check after each phase, not a separate step at the end (per the brief: "As you go, critically assess what the AI produces"). Where we define acceptance criteria, distinguish criteria that come directly from the brief's wording from criteria that reflect our own design decisions about how to operationalize something the brief only states loosely - label each one accordingly. Add a short "Known constraints" section (Angular for the frontend). Keep it concise - this is a working plan, not a design document.
```

## 2026-09-25 15:20 +02:00
**Purpose:** Reject a separate product-decisions file (PLAN.md holds them) and verify Phase 6 captures both agreed R4 details.

```
Before I commit, two things:

1. On the PROCESS.md scope question — don't create a separate file for product decisions. PLAN.md already holds those (the ACs, phases, cut line). PROCESS.md stays scoped to what it already is: AI proposals that got rejected or modified, failed tests, corrected assumptions. Keep the current four-file set as is.

2. Does Phase 6's third-channel test capture both details we agreed on: (a) measuring the diff, where only new files plus a registration line should be needed and any change to core alert/dispatch/existing-channel code is a logged finding, and (b) picking a structurally different channel (e.g. webhook or SMS), not a near-copy of email/Slack? If not, add them to PLAN.md
```

## 2026-09-25 15:28 +02:00
**Purpose:** Clarify the four-file rule covers only process docs; keep research artifacts, fold architecture into PLAN.md Phase 3 unless too complex.

```
Good question. The four-file rule was about the process/narrative layer, not all documentation. Keep docs/data-sources.md (Phase 2's actual research output) and docs/screenshots/ and fixtures/ - those are real artifacts, not decision-log duplication. For docs/architecture.md: fold it into PLAN.md's Phase 3 section instead, unless the design turns out complex enough that a short PLAN.md section can't hold it - in that case tell me why before splitting it out, rather than creating it by default.
```

## 2026-09-25 15:33 +02:00
**Purpose:** Rename Phase 6 to use PLAN.md's AC numbering instead of the old R-numbering.

```
One naming fix before we commit: Phase 6's title still says "R4 validation" - that's leftover from the earlier brief analysis, which used R1–R5. PLAN.md uses AC1–AC12 throughout. Rename it to something like "Phase 6: Third channel (AC5/AC9)" so it's self-consistent without needing the earlier analysis to decode it.
```

## 2026-09-25 16:07 +02:00
**Purpose:** Start Phase 1: propose (not finalize) a decision for each ambiguity in the brief.

```
Start Phase 1 per PLAN.md. Propose a decision for each ambiguity - don't finalize them, I'll review before we move on.
```

## 2026-09-25 16:28 +02:00
**Purpose:** Review of Phase 1 proposals: accept most, move D22 (edit/pause) to nice-to-have, mark D2 and D4 provisional.

```
Looked through these. The dedup fix and the no-backfill thing both make sense.
One thing bugs me: D22, letting people edit or pause alerts. It's not in the brief and doesn't map to any AC, and "cheap" isn't really an argument. Just put it on the nice-to-have list instead of building it in by default.
Rest is fine. Just mark D2 and D4 as provisional for now, since they depend on what Phase 2 actually finds.
```

## 2026-09-25 16:33 +02:00
**Purpose:** Commit Phase 1 and start Phase 2 (data source verification).

```
yes commit and start phase 2
```

## 2026-09-25 16:47 +02:00
**Purpose:** Stop source testing; USGS is the only real source, market and news synthetic; update D2/D4/D8 and commit Phase 2.

```
Let's not keep testing GDACS, Stooq, Yahoo, GDELT, Alpha Vantage, or the Guardian any further -USGS alone is enough to satisfy AC8, it's live and already verified. Use USGS as the one real source, drop GDACS from D4, and make market and news synthetic from the start. Update D2, D4, and D8 in PLAN.md, then commit Phase 2.
```

## 2026-09-25 16:54 +02:00
**Purpose:** Start Phase 3 (architecture and data model).

```
continue with phase 3
```

## 2026-09-25 17:01 +02:00
**Purpose:** Phase 3 review: switch to better-sqlite3 if cheap, keep configFields, approve the D8 market dedup simplification.

```
The removed log entries were intentional, no need to restore them.
1. Switch to better-sqlite3 instead of node:sqlite - how much extra work is that right now, before Phase 4 builds on it? If it's small, let's do it now.
2. Keep configFields.
3. Approved, the D8 market dedup simplification.
```

## 2026-09-25 17:10 +02:00
**Purpose:** Start Phase 4 (backend core with email and Slack), verifying Mailpit image/ports and Slack webhook error codes along the way.

```
Start Phase 4 per PLAN.md. Verify the Mailpit image/ports and Slack's webhook error codes as you go - both are unverified in PLAN.md.
```

## 2026-09-25 17:42 +02:00
**Purpose:** Create a .gitignore file and include all relevant generated or local files.

```
hozz már létre git ignore fájlt és ami odatarrtozik tedd már bele
```

## 2026-09-25 17:27 +02:00
**Purpose:** Undo the Phase 4 commit.

```
undo the last commit  please
```
