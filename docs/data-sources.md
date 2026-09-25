# Data sources (Phase 2)

Verified 2026-09-25 by real requests (curl) and the providers' own pages. Anything not confirmed that way is marked **unverified**.

## Outcome

**USGS is the one real, live source** (satisfies AC8). Market and news are synthetic from the start. Testing of other sources was stopped by decision, not because it was complete. See D2, D4, D8 in `PLAN.md`.

## Summary

| Source | Category | Live request | Terms | Verdict |
|---|---|---|---|---|
| USGS GeoJSON feeds | Disaster (earthquakes) | ✅ 200 | ✅ Public domain | **Used: the one real source** |
| GDACS API | Disaster (multi-hazard) | ✅ 200 (after param fix) | ⚠ Unverified (see below) | Not used |
| Alpha Vantage | Market | ✅ 200 (`demo` key) | ⚠ ToS unread (PDF) | Not used; not viable live (25 req/day) |
| Stooq | Market | ❌ bot-check page | — | Rejected |
| Yahoo Finance chart | Market | ✅ 200 | ❌ Unofficial, undocumented | Rejected |
| BBC News RSS | News | ✅ 200 | ❌ Business use needs permission | Rejected |
| GDELT DOC API | News | ❌ 429 on every attempt | ✅ Unrestricted, citation required | **Not reachable** from here |
| Guardian Open Platform | News | ❌ 401 with `test` key | not checked | Rejected (needs a registered key) |

## Details

### USGS earthquake feeds
- **Endpoints:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{significant|4.5|2.5|1.0|all}_{hour|day|week|month}.geojson`. No key.
- **Update rate:** "every minute" (USGS feed docs).
- **Terms:** "USGS-authored or produced data and information are considered to be in the U.S. Public Domain." Credit requested: "U.S. Geological Survey".
- **Fields observed:** `id`, `ids`, `mag`, `alert`, `sig`, `status`, `tsunami`, `time`, `updated`, `url`, `title`, `place`, point geometry.
- **Findings:**
  - `alert` (PAGER level) was `null` for all 12 M4.5+ events in the past day; only the M6.4 in `significant_week` had one (`green`). **Magnitude is the only severity field present on every event.**
  - `updated` is often later than `time`, so events get revised after first publication.
  - `ids` is a comma list (`,us7000tiqc,`), which suggests an event can carry several IDs. **Unverified:** the glossary page renders via JS and couldn't be read.
- **Fixtures:** `fixtures/usgs/significant_week.geojson`, `fixtures/usgs/4.5_day.geojson`.

### GDACS (Global Disaster Alert and Coordination System)
- **Endpoints:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=EQ` and `.../SEARCH?eventlist=EQ;TC;FL;VO;DR;WF&alertlevel=Orange;Red`. No key. The first URL tried (`.../MAP` with no params) returned 400 `"Eventtype is required."`.
- **Coverage:** earthquakes, tropical cyclones, floods, volcanoes, droughts, wildfires. SEARCH with Orange/Red returned 92 events from 2025-05-21 to 2026-09-22.
- **Importance signal:** `alertlevel` ∈ Green/Orange/Red, plus `alertscore` and `severitydata` (e.g. `"Hurricane/Typhoon > 74 mph (maximum wind speed of 287 km/h)"`).
- **Identity:** `eventtype` + `eventid`, with a separate `episodeid`, and `episodealertlevel` alongside `alertlevel`. **Alert level can change across episodes**, so an event can escalate after it was first seen.
- **Terms: unverified.** The terms page (`/About/termofuse.aspx`) was read only through a fetch tool that returns a model-written *summary*, not the raw page. That summary quoted disclaimers ("provided 'as is' without warranty of any kind", "should not be used for decision making without prior confirmation of their validity") and stated that the terms "do not explicitly address reuse permissions, attribution requirements, automated access restrictions, or commercial use policies". No reuse clause was quoted from the raw page, so what the terms say about reuse is not established.
- **Not used**, so no fixtures kept.

### Alpha Vantage
- `GLOBAL_QUOTE` with `apikey=demo` returned IBM: `previous close`, `change percent` (`-2.4489%`), `latest trading day`. So the fields for D2's market rule exist.
- **Free tier:** "25 API requests per day" (support page). The `demo` key isn't mentioned there.
- **ToS:** served as a PDF that couldn't be rendered here. **Redistribution terms unverified**, so the real response is **not** committed. It's kept outside the repo as a field-shape reference only.

### Rejected
- **Stooq:** my assumed CSV URL returned 404. The daily-data URL returns a JavaScript bot-verification page, so it can't be used from a server.
- **Yahoo Finance:** returns data, but the endpoint is unofficial with no published API terms. Not built on, and not stored.
- **BBC News RSS:** terms §15: "You're not allowed to pluck metadata from our content or RSS feeds" and "For business use of our RSS feeds you'll need to get our permission". Forwarding headlines by email or Slack is exactly that. Not committed.
- **GDELT:** licence is permissive ("unlimited and unrestricted use … commercial … without fee", citation required), but every request returned 429 ("limit requests to one every 5 seconds"), including the first one and one after a 15s pause. The limit is likely shared by IP. Unreliable for a demo.
- **Guardian:** the `test` key returned 401. It would need a registered key.
