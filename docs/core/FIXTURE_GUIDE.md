# Scanner module fixture guide

Fixture tests pair small, raw inputs (HTML / headers / JSON) with the findings
each scanner module should produce. They run on every PR in milliseconds —
catching regressions in module logic the moment they're introduced.

This is **distinct from** the end-to-end scan corpus (Phase 3.1). The corpus
catches real-world integration drift across whole sites; fixtures catch
regressions inside a single module's pattern-matching, scoring, and severity
classification.

## Where fixtures live

```
src/__tests__/fixtures/modules/<MODULE_ID>/<case-name>.<kind>.<ext>
```

- `<MODULE_ID>` matches the module identifier (e.g. `P1-03`, `P1-08`).
- `<case-name>` is a short, lowercase-with-dashes description: `missing-csp`,
  `jwt-with-role-claim`, `http-form-action`.
- `<kind>` is either `input` or `expected`.
- `<ext>` is `json`, `html`, or `headers` for inputs; always `json` for expected.

A single case can use any combination of input files. They are merged into one
`CrawlResult` and passed to the module's entry point.

## Input file kinds

### `<case>.input.json`

Partial `CrawlResult` (see `src/lib/scanner/types.ts`). Deep-merged over a
default crawl, so you only specify the fields your case cares about. Example:

```json
{
  "finalUrl": "https://example.com",
  "cookies": [
    { "name": "session", "value": "abc", "secure": false, "httpOnly": true, "sameSite": null }
  ]
}
```

### `<case>.input.html`

Raw HTML, assigned verbatim to `crawl.html`. Use this when the module reads
the page body (e.g. P1-08 mixed-content scans `<script>`, `<form>`, `<img>`).

### `<case>.input.headers`

RFC822-style `name: value` lines, one per line. Lower-cased header names are
assigned to `crawl.headers`. Lines starting with `#` are comments.

```
content-security-policy: default-src 'self'
strict-transport-security: max-age=31536000; includeSubDomains
# x-frame-options is intentionally omitted to trigger a finding
```

### `<case>.fetch.json`

Canned responses for modules that probe URLs (P1-01, P1-02, P1-06, P1-07,
P1-11, P1-12, P1-13, P1-14). The harness installs a `global.fetch` mock for
the duration of the test, then restores the original.

```json
{
  "responses": [
    {
      "url": "https://example.com/robots.txt",
      "status": 200,
      "headers": { "content-type": "text/plain" },
      "body": "User-agent: *\nDisallow: /admin\n"
    },
    {
      "urlMatches": "https://example\\.com/api/.*",
      "status": 200,
      "headers": { "access-control-allow-origin": "*" },
      "body": ""
    }
  ],
  "default": { "status": 404, "body": "Not Found" }
}
```

Match order: each `responses[]` entry is checked in array order (first match
wins), then `default`. If neither matches, the mock **throws** — this surfaces
as a clear test failure rather than the module hanging or seeing `undefined`.
That throw is intentional: every URL the module touches must be accounted for.

Response fields:

- `url` — exact string match.
- `urlMatches` — JavaScript regex, tested with `new RegExp(value).test(url)`.
- `status` — default 200.
- `headers` — default `{}`.
- `body` — default `""`.

The mock builds a standard `Response` object, so modules can use `.ok`,
`.status`, `.text()`, `.headers.get()`, etc. as they normally would.

## Expected file

```json
{
  "findings": [
    {
      "moduleId": "P1-03",
      "severity": "MEDIUM",
      "titleIncludes": "Content-Security-Policy"
    }
  ]
}
```

Match semantics:

- Every `expected` finding must match exactly one actual finding (in any order).
- Any actual finding the test didn't match is flagged as **unexpected**.
- Each field on an expected entry is a **subset match**:
  - `moduleId`, `severity`, `category` — exact equality.
  - `titleIncludes`, `evidenceIncludes` — substring match (use this for any
    free-text field; module wording changes shouldn't break the test).

To assert "no findings", use:

```json
{ "findings": [] }
```

## Coverage minimums per module

Phase 3.10 requires every module to have at least:

- **3 positive cases** — the module *should* flag this input.
- **3 negative cases** — the module *should not* flag this input. Pick the
  classic false-positive traps for that module (intentional CORS-public APIs,
  custom 404 pages, base64 image data URLs, etc.).
- **1 edge case** — empty input, malformed input, very large input. Should
  fail gracefully without crashing or hallucinating findings.

## Bug-report → fixture

When a customer or telemetry reports a bad finding, the first fix is **a new
fixture**. Add the minimal `input` that reproduces the bug, set the
`expected` to the correct behavior, watch it fail, then fix the module. The
regression is now locked in forever.

## Running

```bash
yarn test:fixtures      # just the fixture suite (target: <30s)
yarn test               # full vitest suite, fixtures included
```

The fixture runner auto-discovers everything under
`src/__tests__/fixtures/modules/`. Adding a new case requires no code change —
just drop the files in and the next test run picks them up.

## Adding support for a new module

1. Export the module from `src/lib/scanner/modules/` with a
   `(crawl: CrawlResult) => RawFinding[] | Promise<RawFinding[]>` signature.
2. Register it in `MODULE_REGISTRY` in
   `src/__tests__/lib/scanner/fixtures/runner.ts`.
3. Create the fixture directory and add at least 3 + 3 + 1 cases.

### Modules that make network calls

The runner installs a `global.fetch` mock per case, so modules that probe
live endpoints can be fixtured by adding a `<case>.fetch.json` file (see
above). For network-probing modules a fetch spec is effectively required —
if your case is missing canned responses for any URL the module touches,
the mock throws and the test fails with a clear "no canned response for
&lt;URL&gt;" message.
