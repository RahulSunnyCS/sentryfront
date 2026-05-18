# Senior Software Engineer — Consolidated Review (Security + Performance + Architecture)

Scope: P1-05 cookies, P1-03 headers, P1-10 DNS/email, P1-19 DOM XSS (new), P1-07 CORS.
Risk level: HIGH (security scanner platform; backend + product tags).
Lens emphasis: backend.

This is a passive scanning platform. The dominant risk class here is not the
scanner being attacked — it is the scanner being **wrong**: a false negative
gives a user false confidence, and a false positive erodes trust and buries
real findings. I weighted the review accordingly.

---

## 🔴 Critical

### C1 — P1-07 CORS: the API-path probe cap is broken; scanner probes *every* `/api/` path on the target (performance / DoS-to-self / blast radius)
File: `src/lib/scanner/modules/p1-07-cors.ts:11-16`

```js
const apiPathRe = /["'](\/api\/[^"'\s?#]{1,60})["']/g;
let m;
const apiPaths: string[] = [];
while ((m = apiPathRe.exec(crawl.html)) !== null && apiPaths.length < 3) {
  try { urlsToProbe.push(new URL(m[1], crawl.finalUrl).href); } catch {}
}
```

The loop guard is `apiPaths.length < 3`, but the body pushes to `urlsToProbe`
and **never pushes to `apiPaths`**. `apiPaths.length` is permanently `0`, so
the `< 3` cap never engages. The loop only terminates because the regex is
global and `exec` walks to end-of-HTML — meaning the scanner will fire a live
network `GET` **and** a live `OPTIONS` against *every distinct `/api/...`
string in the page HTML*, with no upper bound.

Why this is Critical here:
- Each probe is a real outbound request with an `Origin: https://evil.attacker.example`
  header and an 8s timeout. On an app that embeds many `/api/...` strings in
  its bundle/HTML (typical for an SPA), this is dozens-to-hundreds of paired
  GET+OPTIONS requests, serially (`for ... await`), each up to 8s. This will
  routinely blow the 120s `SCAN_TIMEOUT_MS` and starve every other module of
  budget — a self-inflicted scan DoS and a correctness regression for the
  whole scan, not just P1-07.
- It also makes VibeSafe send a large, unbounded volume of attacker-looking
  preflight traffic at a third-party target the user only asked to "scan" —
  a real abuse/reputation concern for a hosted product.
- Duplicate URLs are also not de-duplicated, compounding the volume.

Fix: push the resolved URL into `apiPaths` (or test `urlsToProbe.length`),
de-duplicate, and enforce a hard cap (the intended 3). Add an overall probe
ceiling independent of the regex. Suggested:

```js
while ((m = apiPathRe.exec(crawl.html)) !== null && apiPaths.length < 3) {
  try {
    const href = new URL(m[1], crawl.finalUrl).href;
    if (!urlsToProbe.includes(href)) { apiPaths.push(href); urlsToProbe.push(href); }
  } catch {}
}
```

This is the one finding that must be fixed before Gate 2 regardless of the
deep-dive.

---

## 🟡 Medium

### M1 — P1-05 cookie heuristic blind spot ships a real false-negative on this very product (security / false negative)
File: `src/lib/scanner/modules/p1-05-cookies.ts:45-55`

The code comments it itself: `looksLikeSessionCookie()` does not match
NextAuth's `__Secure-`/`__Host-`-prefixed cookies because
`SESSION_COOKIE_PATTERNS` has no prefix rule. NextAuth (this product's own
auth stack — `next-auth.session-token` / `__Secure-next-auth.session-token`)
is one of the most common targets a user will scan. A scanner that silently
skips the HttpOnly/Secure/SameSite verdict on the single most common session
cookie family in the Next.js ecosystem is a meaningful false negative on a
HIGH-risk security check.

The task contract forbids editing `tools/cookies.ts`, so this cannot be fixed
in-module without violating scope. Recommendation: surface to the user as an
accepted limitation **and** open a follow-up task to extend
`SESSION_COOKIE_PATTERNS` with the `__Secure-`/`__Host-` prefix family. Do not
let it pass silently — it is exactly the class of gap this platform exists to
catch.

### M2 — P1-05 JWT decode: `Buffer.from(x,'base64')` is lax; risk of false-positive "JWT" classification (security / false positive)
File: `src/lib/scanner/modules/p1-05-cookies.ts:4-13, 100-132`

`looksLikeJWT` splits on `.`, base64-decodes part 2, and accepts anything that
`JSON.parse`s to a non-null object. JWT uses **base64url**, not base64;
`Buffer.from(..., 'base64')` is permissive and will also decode base64url-ish
input, which is mostly fine, but the bigger issue is the classifier is
structurally weak: any opaque `a.{json-ish-base64}.c` cookie value (some
session/CSRF cookies are dotted) can be misread as a JWT, and if it happens to
contain a key matching `/role|tier|plan|premium|admin|subscription|level/i`
(note `level` matches `accesslevel`, `toplevel`, etc.) it emits a **HIGH**
"JWT with authorization claims" finding. On a security product a spurious
HIGH is costly. Recommend: require the header segment to also decode to an
object containing `alg`/`typ`, and decode with base64url, before classifying.
Low likelihood but HIGH-severity output, hence Medium.

### M3 — P1-19 regex pattern 2 (innerHTML) can both over- and under-match (security / accuracy)
File: `src/lib/scanner/modules/p1-19-dom-xss.ts:78`

`/\.innerHTML\s*=\s*[^;\n]{0,80}?(?:location|document\.referrer)\b/`

- Minified bundles routinely strip newlines and pack many statements between
  semicolons; `[^;\n]{0,80}` will then span unrelated code, producing a match
  where `.innerHTML=` and a `location` reference are coincidentally within 80
  chars of two different statements → false positive. The module marks
  `confidence: 'low'` and caps at 10, which mitigates user impact, but on a
  security product even a low-confidence HIGH should be tighter.
- Conversely, real concatenation chains (`x.innerHTML = a + b + sanitize(c) +
  location.hash`) longer than 80 chars are missed → false negative.

This is inherent to regex-on-minified-JS and the module is honest about it
(low confidence, code-review caveat in the finding). Acceptable as shipped,
but flag for the deep-dive to sanity-check the false-positive rate against the
corpus replay (`npm run test:corpus`).

### M4 — P1-10 apex extraction is naive for multi-label public suffixes (security / accuracy)
File: `src/lib/scanner/modules/p1-10-dns-email.ts:24-26`

`parts.slice(-2).join('.')` computes `co.uk`, `com.au`, `github.io` as the
"apex" for `foo.co.uk` etc. SPF/DMARC/DKIM lookups then target the wrong name,
producing **false "No SPF/DMARC record found" MEDIUM findings** for every
domain under a multi-label public suffix (a large fraction of the non-US web,
including `.co.uk`, `.com.br`, `.com.au`). MEDIUM findings, wrong answer, on a
common input class. A full PSL is heavy, but at minimum special-case the
common 2-label ccTLD SLDs or document the limitation. Recommend fixing or
explicitly accepting with a documented caveat.

### M5 — P1-07 OPTIONS method check fires on the page origin / static paths (architecture + false positive)
File: `src/lib/scanner/modules/p1-07-cors.ts:106-191`

The OPTIONS pass always probes `crawl.finalUrl` itself (the HTML page). Many
frameworks/CDNs answer `OPTIONS` on arbitrary paths with a permissive
`Access-Control-Allow-Methods` (e.g. `*` or a broad set) at the edge without
that implying an app-level CORS hole. Combined with the "non-API path" gate,
this can emit a MEDIUM "destructive methods allowed on non-API path" for the
landing page of sites fronted by common CDNs. Low-to-moderate FP risk;
recommend the deep-dive validate against the corpus and consider only flagging
when `Access-Control-Allow-Origin` is also reflected/permissive.

---

## 🟢 Low

- **L1 — P1-07 serial probes, no parallelism.** Even after C1 is fixed (≤4
  URLs), each URL does a sequential GET then OPTIONS, each up to 8s → worst
  case ~64s for 4 URLs, a large slice of the 120s budget. Consider
  `Promise.all` over URLs (the GET-CRITICAL early-break would need rework) or a
  tighter per-request timeout (3–4s). Architecture-wise this module is the
  heaviest live-network module; it sits in the Group-1 parallel block which
  helps, but internal serialization still dominates.
- **L2 — P1-19 `MAX_FINDINGS` break leaves outer loop relying on inner break.**
  Logic is correct (double-checked: inner `break` + outer `if (>=MAX) break`),
  but the early-exit is duplicated; minor. The `firedPatternIndices` set is
  redundant — the `for i` loop never revisits an index in one chunk — dead
  code, harmless.
- **L3 — P1-03 `checkHsts` accepts `max-age` with no quotes only.** RFC 6797
  allows quoted values (`max-age="31536000"`). Regex `max-age\s*=\s*(\d+)`
  misses quoted forms → false "no max-age" LOW. Rare in practice; low.
- **L4 — P1-03 CSP `default-src` fallback ignores the absence of `script-src`
  vs `object-src`/`base-uri`.** The check is intentionally scoped to script
  policy and documents this; acceptable, noted for completeness — `base-uri`
  / `object-src` weaknesses are not detected (false negative by design).
- **L5 — P1-10 DKIM 9-selector parallel probe** is fine for I/O budget
  (`Promise.allSettled`, errors swallowed). One observation: all 9 + SPF +
  DMARC DNS lookups have no explicit timeout; a black-holed resolver could
  hang up to the OS resolver default. Low risk given Group-1 parallelism and
  the overall scan timeout, but a per-lookup timeout would be more robust.

---

## Architecture / Contract Compliance

- All five modules honor the `runXxxModule(crawl): RawFinding[]` (or
  `Promise<RawFinding[]>`) contract; correctly wired in `scanner/index.ts`
  (async ones in the Group-1 `Promise.all`, sync ones in Group 2); P1-19
  registered in `SCAN_MODULES` / `data.ts`. No cross-module imports
  introduced. Graceful no-op on static-fetch fallback for P1-19 is correct
  (`loadedChunkContents` optional, guarded). P1-03 feature-flag gating is
  consistent with the existing `HeaderCheck.flag` pattern. Good adherence
  overall.
- P1-07 is the architectural outlier: it performs unbounded live network I/O
  driven by untrusted page content (C1), and its GET/OPTIONS de-dup logic via
  `getCriticalUrls` is intricate and easy to regress. Recommend a small refactor
  to a single "probe one URL" function returning findings, with the URL set
  built once and capped.
- Error handling is uniformly defensive (try/catch around fetch/DNS/JSON,
  empty-array returns). No unredacted secrets emitted; evidence fields clip
  length and mask cookie values (`name=...`). Good.

---

## Verdict

```
OPUS DEEP-DIVE: REQUIRED
Reason: risk_manifest.risk_level is HIGH and this is core security-detection
logic with a public-facing-API surface and an auth/session check (P1-05),
so the security-auditor deep-dive is forced regardless. Scope the deep-dive
to: (1) C1 — the P1-07 unbounded API-path probe (correctness + scan-timeout +
outbound-abuse blast radius) and the GET/OPTIONS de-dup state machine;
(2) the false-negative on NextAuth `__Secure-`/`__Host-` cookies (M1) and the
weak JWT classifier (M2) in P1-05; (3) accuracy/false-positive-rate validation
of the P1-19 innerHTML regex (M3) and the P1-07 OPTIONS method check (M5)
against the corpus replay; (4) the P1-10 public-suffix apex bug (M4) that
yields wrong MEDIUM SPF/DMARC verdicts. C1 must be remediated before Gate 2;
the rest are CONDITIONAL-PASS candidates pending the auditor's FP/FN judgement.
```

Report saved to `/home/user/sentryfront/pipeline/reviews/senior-review.md`.
