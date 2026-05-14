# Severity Rubric — Exploit-Intel Tiering

Phase 3.3. Defines how VibeSafe assigns a `Severity` bucket to vulnerability findings that carry CVE-level data (currently P1-16 client-side dependency findings; Phase 7.5 will extend the same rubric to server-side dependency findings).

The rubric combines three signals:

1. **CVSS base score** — theoretical severity, from the CVE record (via OSV.dev).
2. **CISA KEV** — Known Exploited Vulnerabilities catalog. Membership means "actively exploited in the wild," confirmed by CISA. Public-domain feed.
3. **FIRST.org EPSS percentile** — Exploit Prediction Scoring System. The percentile rank of the CVE's exploit-probability score within the global CVE population. CC-BY-4.0 feed.

## Policy: Conservative fallback

EPSS-driven *downgrades* require **positive evidence**: a real, returned `epssPercentile` below the threshold. If FIRST.org's API is down, returns no data for a CVE, or returns an unparseable response, we treat `epssPercentile` as `null` and preserve the CVSS-only severity bucket. We do **not** surprise-downgrade findings during an external-feed outage.

KEV-driven *escalation* is unconditional: any CVE in the KEV catalog short-circuits to `CRITICAL`, regardless of CVSS or EPSS.

## Table

Evaluated top-down. First matching row wins.

| Condition | Severity |
|---|---|
| `kevMatch === true` | **CRITICAL** |
| `cvssBase >= 9.0 && epssPercentile === null` | **CRITICAL** (conservative fallback) |
| `cvssBase >= 9.0 && epssPercentile >= 90` | **CRITICAL** |
| `cvssBase >= 9.0 && epssPercentile >= 50` | **HIGH** |
| `cvssBase >= 9.0` | **MEDIUM** |
| `cvssBase >= 7.0 && epssPercentile === null` | **HIGH** (conservative fallback) |
| `cvssBase >= 7.0 && epssPercentile >= 50` | **HIGH** |
| `cvssBase >= 7.0` | **MEDIUM** |
| `cvssBase >= 4.0` | **MEDIUM** |
| `cvssBase` is a number `< 4.0` | **LOW** |
| `cvssBase === null` (no CVSS data at all) | **LOW** |

Worked examples:

- CVSS 7.5 + EPSS 60 → **HIGH** (CVSS-high bucket, EPSS confirms exploit activity).
- CVSS 7.5 + EPSS 30 → **MEDIUM** (downgrade — EPSS gives positive evidence of low exploit activity).
- CVSS 7.5 + EPSS unknown → **HIGH** (conservative fallback — no positive evidence to downgrade).
- CVSS 9.5 + EPSS 85 → **HIGH** (CRITICAL requires EPSS >= 90 to confirm).
- CVSS 8.0 + KEV match → **CRITICAL** (KEV short-circuits).
- No CVEs at all → **LOW**.

## Data sources

| Source | URL | License | Refresh | Cache |
|---|---|---|---|---|
| CISA KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Public domain (US Government work) | On-demand, 24h cache | Set of CVE IDs |
| FIRST.org EPSS | `https://api.first.org/data/v1/epss?cve=<id>` | CC-BY-4.0 | On-demand, per-CVE, 24h cache | `{score, percentile}` |
| CVSS base score | `https://api.osv.dev/v1/vulns/<id>` (Phase 3.2) | Apache 2.0 (OSV.dev) | On-demand, 24h cache | OSV vuln record |

On-demand fetching is preferred over a cron pre-warm: first scan after expiry pays the feed cost; subsequent scans (well within the 24h window) hit the cache. No batch infrastructure is required.

## Telemetry stamped on each finding

Every finding produced under the new rubric carries:

- `severity` — the rubric's output.
- `kevMatch: boolean` — whether the finding's CVE(s) hit the KEV catalog.
- `epssPercentile: number | null` — max EPSS percentile across the finding's CVEs (0–100), or `null` if EPSS lookup returned no data for any of them.

These fields are optional on `RawFinding`. Legacy modules that don't consult KEV/EPSS leave them undefined; the report renderer and dashboard treat missing values as "not applicable."

## Kill switch

Feature flag: `exploitIntelSeverity` in `src/lib/features.ts`. On by default. Override via env:

```
FEATURES='{"exploitIntelSeverity":false}'
```

When off, P1-16 falls back to the Phase 3.2 `assignSeverity(scores)` stub (max-CVSS-only buckets). KEV and EPSS clients are never called.

## Failure semantics

| Scenario | Outcome |
|---|---|
| KEV feed unreachable (5xx, timeout, parse error) | Empty Set returned. `kevMatch` defaults to `false`. Warn logged once per worker per 24h cache window. |
| EPSS API returns 404 for a CVE | `getEpss` returns `null`. Conservative fallback preserves CVSS bucket. |
| EPSS API returns 5xx or times out | `getEpss` returns `null`, same path as 404. Warn logged per call. |
| Both feeds down + flag on | Severity equals the CVSS-only bucket — identical to flag-off behavior. Scan never aborts. |

The KEV/EPSS clients are wrapped by `runClientDepsModule`'s module-level try/catch, so even a programming error inside `resolveSeverity` cannot abort the scan.
