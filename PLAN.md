# Plan

Working plan for taking the brief (`docs/brief.pdf`) to a working implementation. Changes to this plan are logged in `PROCESS.md`.

## Known constraints

- **Frontend: Angular.** Fixed. Not revisited during design.
- **Timebox: ~24h** (brief). A partial, well-reasoned result beats a complete, undocumented one, so phases are ordered so that stopping early still leaves something coherent.

## Acceptance criteria

**[Brief]** = taken directly from the brief's wording. **[Ours]** = our operationalization of something the brief states loosely. [Ours] criteria are design decisions, so they can be challenged and are confirmed or revised in Phase 1.

| # | Criterion | Source |
|---|-----------|--------|
| AC1 | Users can set up alerts. | [Brief] |
| AC2 | Users get notified when something important happens in the world (e.g. breaking news, market movements, natural disasters). | [Brief] |
| AC3 | Notifications can be delivered by email. | [Brief] |
| AC4 | Notifications can be delivered to Slack. | [Brief] |
| AC5 | More channels can be added later. | [Brief] |
| AC6 | There is an admin view. | [Brief] |
| AC7 | "Important" is defined by an explicit, documented, testable rule per event type, not left implicit or to an opaque judgment. | [Ours] |
| AC8 | At least one event category runs end-to-end from a real, verified data source; other categories may use recorded fixtures. The brief's list is illustrative ("that kind of thing"), not a checklist. | [Ours] |
| AC9 | AC5 is proven by adding a third, structurally different channel in its own commit. That commit touches only new files plus a registration point, with no edits to alert logic, dispatch, or existing channels. | [Ours] |
| AC10 | One real-world event produces at most one notification per matching alert (dedup). | [Ours] |
| AC11 | Every delivery attempt is recorded with its status; failures are visible in the admin view. | [Ours] |
| AC12 | The app runs locally and can be demoed without real Slack or email credentials (local mail catcher, Slack stub or webhook), and events can be injected or replayed on demand. | [Ours] |

## Phases

Each phase ends with the **validation gate** (below) and a milestone commit on `main`.

### Phase 1: Product decisions
Resolve the brief's ambiguities: the alert model, what counts as "important", delivery timing, Slack mode, auth model, and admin scope. Each gets a decision or an explicit deferral.
- **Produces:** updates to this file: confirmed or revised [Ours] criteria, plus each decision and any assumption behind it, labeled as such.
- **Phase check:** every ambiguity found in the brief analysis is either decided or explicitly deferred. Nothing is assumed silently.

### Phase 2: Data source verification spike
Check the candidate sources (disaster, market, news feeds) by making real requests, not by trusting descriptions.
- **Produces:** `docs/data-sources.md` (endpoint, auth, rate limits, terms, sample payload, verdict per source) and recorded payloads under `fixtures/`.
- **Phase check:** every claim about a source (URL, fields, limits, license) is backed by a real response or the provider's own docs. Sources that fail are logged as rejected.

### Phase 3: Architecture and data model
Backend stack, domain model (events, alerts, users, channels, deliveries), the channel abstraction, and the ingest → detect → match → dispatch flow.
- **Produces:** the architecture written into this section (short, with one diagram) and the schema. If the design grows too complex for a short section, Claude explains why and asks before splitting it into a separate file.
- **Phase check:** every AC maps to a component. The channel interface is checked on paper against email, Slack, and a third hypothetical channel before any code exists.

### Phase 4: Backend core with email and Slack
Ingestion, normalization, importance rules, matching, dedup, dispatch, delivery log, and the email and Slack channels. Includes a way to inject or replay events.
- **Produces:** backend code and tests driven by the Phase 2 fixtures.
- **Phase check:** tests pass, including dedup and channel-failure cases. There is a manual end-to-end run: inject an event, see the email in the mail catcher, see the Slack message or stub call.

### Phase 5: Angular frontend
The user UI for creating and managing alerts, and the admin view (scope as decided in Phase 1).
- **Produces:** Angular app wired to the backend, and screenshots in `docs/screenshots/`.
- **Phase check:** the app builds, and the demo flow works in the browser: create an alert → inject an event → the notification arrives → the delivery shows in the admin view.

### Phase 6: Third channel (AC5/AC9)
Add a third channel in its own commit, as the evidence for AC5.
- **Channel choice:** structurally different from email and Slack (e.g. generic outbound webhook or SMS), with different config, payload, or failure modes. A near-copy of an existing channel would pass without testing whether the abstraction generalizes.
- **Diff measurement:** the commit should need only new files plus one registration line. Any change to core alert logic, dispatch, or existing channels is a finding and is logged in `PROCESS.md`.
- **Produces:** the channel, its tests, and the commit's diff-stat recorded in the commit message and in this phase's result below.
- **Phase check:** AC9, judged by the actual diff.

### Phase 7: Wrap-up
- **Produces:** `README.md` (how to run it, what's real vs. fixture, known gaps), and a short retrospective of what's incomplete and why.
- **Phase check:** a fresh clone runs by following the README alone.

**Cut line if time runs short:** Phases 1–4 and 6 are the core (they prove AC1–AC5 and AC9). Phase 5 can shrink to the minimum UI. AC8's real source can fall back to fixtures, provided that is stated clearly.

## Validation gate (after every phase)

AI output is checked as it is produced, not in a final review:

1. **Read before accepting.** Every generated file is reviewed, not skimmed. Plausible-looking output isn't treated as correct.
2. **Verify external facts.** API endpoints, library APIs, package versions, and provider limits are confirmed by running them or checking primary docs. Anything unverified is marked as such.
3. **Run it.** Build, tests, and the phase's end-to-end check actually run. Claims of "this works" need output to back them.
4. **Check against the ACs.** Confirm the phase moved the intended ACs forward and didn't quietly redefine a [Brief] criterion.
5. **Log corrections.** Rejections, failed tests that forced a logic fix, and wrong assumptions go into `PROCESS.md` (per `CLAUDE.md`).
6. **Commit** the milestone on `main`.
