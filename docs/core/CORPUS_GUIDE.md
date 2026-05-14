# Scan-quality corpus guide

The corpus is an **integration-test seam** that catches end-to-end scan drift on
real sites: when a per-module fix silently regresses the overall grade of a
canonical site, the corpus replay fails on the next PR.

This is distinct from the per-module fixtures under `src/__tests__/fixtures/modules/`,
which catch regressions inside a single module against synthetic inputs. The
corpus catches *integration* regressions: header changes interacting with cookie
changes interacting with the sourcemap module, etc.

## Where corpus fixtures live

```
src/__tests__/fixtures/corpus/<slug>/
  meta.json        # { url, recordedAt?, gitSha?, notes? }
  crawl.json       # serialized CrawlResult (pre-recorded)
  responses.json   # captured fetch exchanges driving module probes
  expected.json    # locked baseline: grade, score, findings set, module counts
```

The slug is a short kebab-case identifier (`juice-shop`, `example-com`).

## What gets compared

`expected.json` pins:

- `grade` — exact match (A / B / C / D / F)
- `score` — within ±1 (tolerates tiny LOW/INFO drift)
- `findingsCount` — exact
- `moduleFindingCounts` — exact, per-module
- `findings` — exact set of `(moduleId, severity, title)` tuples; sorted for stable diffs

Excluded from the baseline so the signal stays deterministic:

- `P1-10` (DNS / email) and `P1-11` (subdomain takeover) — depend on live DNS
  that isn't captured in fetch fixtures. Regression coverage stays in unit
  tests.
- `P2-Performance`, `P3-Accessibility`, `P4-SEO` — Lighthouse-driven; require a
  real browser. Corpus replay runs with these features disabled.

TLS information in `crawl.json` is always nulled out at record time —
`tls.daysUntilExpiry` shifts on every cert renewal and would make every site's
baseline flake. P1-04 TLS coverage stays in unit tests.

## Running the corpus

Replay (no network, fast, runs in CI):

```
yarn test:corpus
```

Record / re-record a single site against the live network:

```
yarn corpus record --site juice-shop
```

Record every registered site:

```
yarn corpus record --all
```

Recording requires real outbound HTTPS. `node_modules/.bin/vitest` does the
work; the wrapper just sets `CORPUS_MODE=record` and the requested site list.

## Adding a site

1. Pick a slug. Create the directory:

   ```
   mkdir src/__tests__/fixtures/corpus/<slug>
   ```

2. Drop a `meta.json` with the target URL and a one-line note:

   ```json
   {
     "url": "https://example.org/",
     "notes": "Why this site is in the corpus."
   }
   ```

3. Record the baseline:

   ```
   yarn corpus record --site <slug>
   ```

4. Inspect the generated `expected.json`. If the grade or finding set looks
   wrong for the site, that's a scanner bug worth filing — don't paper over it
   by editing the baseline.

5. Commit all four files.

## When the corpus fails on a PR

Read the diff. A drift failure prints the missing and unexpected findings,
plus grade/score/count deltas. Common causes:

- A per-module fix changed real-world detection coverage. Re-record the
  affected sites (`yarn corpus record --site <slug>`) and review the new
  baseline before committing.
- The site changed (rolled new headers, new framework). Re-record.
- A flaky fetch exchange — re-record once; if it keeps drifting between
  recordings the site is unstable for corpus use, swap it out.

Never silently re-record to make CI green. The baseline drift is the signal.

## Out of scope (deferred)

- **Playwright capture** — fetch-only today; headless-rendered crawl coverage
  lives in the per-module unit tests until the premium tier ships.
- **30+ site target** — corpus ships at 10 sites; expand iteratively via the
  one-command flow above.
- **`INTERNAL_SCAN=true` LLM-enriched baselines** — enrichment is
  non-deterministic; pinning it requires a separate snapshot layer.
