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
