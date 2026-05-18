SECURITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━

Scope: FORCED Opus/max deep-dive, scoped to 6 senior-reviewer findings on the
5 new/updated P1 scanner modules. This is not a cold full audit.

Verdicts: CONFIRMED (real issue) | MITIGATED (already handled) | FALSE ALARM (not exploitable)

────────────────────────────────────────────────────────────────────

FINDING C1 — P1-07 CORS probe cap broken
Verdict: CONFIRMED (Critical — confirmed, fix NOT applied in the file as read)
File and line: src/lib/scanner/modules/p1-07-cors.ts:13-16

What it is:
The discovery loop is:

```
const apiPaths: string[] = [];
while ((m = apiPathRe.exec(crawl.html)) !== null && apiPaths.length < 3) {
  try { urlsToProbe.push(new URL(m[1], crawl.finalUrl).href); } catch {}
}
```

The loop guard is `apiPaths.length < 3`, but the body pushes only to
`urlsToProbe` — `apiPaths` is declared, never written, and stays length 0
forever. The intended "probe at most 3 discovered API paths" cap therefore
never fires. The loop terminates only when the global regex
`/["'](\/api\/[^"'\s?#]{1,60})["']/g` is exhausted, i.e. after EVERY
`/api/...` literal in the crawled HTML has been added to `urlsToProbe`.

Why it matters:
`urlsToProbe` is iterated twice — once with a GET probe (8s timeout each) and
once with an OPTIONS probe (8s timeout each), each carrying a forged
`Origin: https://evil.attacker.example` header. Blast radius:

- Outbound traffic amplification: a page that embeds many `/api/...` strings
  (common in bundled/SPA HTML, JSON-LD, inline config blobs, or a hostile
  page deliberately crafted to do so) causes the scanner to fire 2 requests
  per matched path at the target. There is no numeric ceiling — N matches
  ⇒ up to 2N forged-Origin requests.
- Scan-timeout exhaustion: the scanner runs under a hard 120s
  SCAN_TIMEOUT_MS. Worst case per URL ≈ 8s (GET) + 8s (OPTIONS) sequential.
  ~8 matched paths is enough to consume the entire scan budget, marking the
  scan TIMEOUT and discarding the other P1 modules' value for that scan.
- Abuse / SSRF-flavoured amplification: because probe URLs are derived from
  attacker-influenceable page content and resolved against `crawl.finalUrl`,
  a user can submit a URL whose page lists many `/api/...` strings to make
  VibeSafe's infrastructure emit a burst of attacker-shaped requests. The
  `new URL(m[1], crawl.finalUrl)` base-resolution keeps the host pinned to
  the scanned origin (good — it does not enable arbitrary-host SSRF), but the
  request count is unbounded, which is a self-inflicted DoS / traffic-abuse
  vector and exactly the "unexpected outbound traffic" the brief calls out.
- Note the `break` at line 60 only short-circuits the GET pass AFTER a
  wildcard-credentials CRITICAL is found; it does nothing for the common case
  where no such finding exists, and the OPTIONS pass has no equivalent
  early-exit. So the break does not bound the loop in the general case.

This is a genuine CRITICAL availability/abuse bug, correctly classified by
the senior reviewer. It is NOT a confidentiality/integrity bug (host stays
pinned), but it does break the scanner under hostile or merely
API-string-heavy input and produces unbounded outbound traffic.

How to fix it:
Increment a real counter. Minimal correct fix:

```
let added = 0;
while ((m = apiPathRe.exec(crawl.html)) !== null && added < 3) {
  try { urlsToProbe.push(new URL(m[1], crawl.finalUrl).href); added++; } catch {}
}
```

(Increment only on a successful push so malformed URLs that hit the `catch`
do not consume a slot — or increment unconditionally if you prefer the cap
to bound regex iterations regardless. Either is acceptable; the key is that
the guard variable actually changes.) Recommended hardening: also dedupe
`urlsToProbe` (a Set) so repeated identical `/api/...` strings cannot each
cost a probe, and keep the total probe count (including `crawl.finalUrl`)
hard-capped (e.g. ≤4) independent of the regex.

────────────────────────────────────────────────────────────────────

FINDING M1 — P1-05 cookie heuristic misses NextAuth __Secure-/__Host- prefixed cookies
Verdict: CONFIRMED (Low severity — real blind spot, low real-world exploit value)
File and line: src/lib/scanner/tools/cookies.ts:14-31; consumed in
src/lib/scanner/modules/p1-05-cookies.ts:21-79

What it is:
`SESSION_COOKIE_PATTERNS` has no pattern that tolerates the RFC 6265bis
`__Secure-` / `__Host-` cookie-name prefixes. `/^next.?auth/i` requires the
name to START with `next`/`nextauth`, but the real production NextAuth cookie
is `__Secure-next-auth.session-token` (and `__Host-next-auth.csrf-token`).
`looksLikeSessionCookie()` returns false for both, so a real NextAuth session
cookie is never evaluated for Secure/HttpOnly/SameSite. The code comment at
p1-05-cookies.ts:50-52 explicitly acknowledges this and forbids fixing
tools/cookies.ts in that task — so it is a known, accepted-in-task blind
spot, not an accident.

Why it matters (attacker exploitability assessment — the actual question):
The exploit value is LOW, for structural reasons:
- The `__Secure-` prefix is enforced by the browser: it refuses to store a
  `__Secure-`-prefixed cookie that lacks the `Secure` attribute, and
  `__Host-` additionally requires `Secure`, `Path=/`, and no `Domain`. So a
  cookie that actually reaches the scanner with one of these names is
  guaranteed by the UA to already be Secure. The "missing Secure" finding is
  therefore moot for these names by construction.
- HttpOnly is NOT enforced by the prefix. A genuinely misconfigured NextAuth
  deployment that sets `__Secure-next-auth.session-token` WITHOUT `httpOnly`
  is exploitable via XSS, and P1-05 would stay silent — a true
  false-negative. However: NextAuth sets HttpOnly on its session-token
  cookie by default; suppressing it requires a deliberate, unusual custom
  `cookies` config. The blind spot only bites that specific misconfiguration.
- Net: this weakens VibeSafe's detection (it will under-report a real,
  if uncommon, HttpOnly gap on the single most popular Next.js auth library —
  and this is a Next.js-focused product, so its own audience is disproportionately
  affected). It is not itself a vulnerability in VibeSafe and not
  attacker-exploitable against VibeSafe. Senior reviewer's MEDIUM is
  defensible as a product-quality miss; from a pure exploitability lens it is
  LOW. Recommend tracking as a real false-negative to fix, not a blocker.

How to fix it:
Make the matcher prefix-tolerant rather than adding per-name patterns:
strip an optional `__Secure-` / `__Host-` prefix before testing, e.g. test
`cookie.name.replace(/^__(Secure|Host)-/i, '')` against the existing
patterns. That single change recovers `__Secure-next-auth.session-token`
(via `/^next.?auth/i`) and every other prefixed session cookie at once.
(Out of scope for the task that has the comment lock — schedule as a
follow-up to tools/cookies.ts with its own test.)

────────────────────────────────────────────────────────────────────

FINDING M2 — P1-05 JWT authorization-claim classifier over-broad
Verdict: CONFIRMED (Low severity — real false-positive risk, bounded)
File and line: src/lib/scanner/modules/p1-05-cookies.ts:101-131 (regex line 107)

What it is:
For any cookie whose value is a structurally valid 3-part JWT with a
JSON-object payload, the module flags HIGH if any payload KEY matches
`/role|tier|plan|premium|admin|subscription|is_pro|level/i`. The regex is
unanchored substring matching on the key name, so it also matches keys that
merely CONTAIN those substrings.

Why it matters (false-positive assessment — the actual question):
Two independent FP sources:
1. `looksLikeJWT()` accepts anything with 3 dot-separated parts whose middle
   part base64-decodes to any JSON object. It does not verify the header, the
   signature, or that this is actually a JWT. Random `a.b.c` values rarely
   decode to JSON objects, so this part is fairly safe in practice, but it is
   not a true JWT check.
2. The key regex is substring, case-insensitive, and unanchored. Real-world
   benign collisions that would wrongly produce a HIGH "JWT with
   authorization claims" finding:
   - `level` → matches `log_level`, `zoom_level`, `level_of_detail`,
     analytics `engagement_level`.
   - `plan` → matches `plan` used for a non-billing "plan/itinerary",
     `floorplan`, `planId` for a travel/project app.
   - `role` → matches ARIA-ish `role`, `author_role` editorial metadata,
     `payroll` (contains `roll`? no — `role` ≠ `roll`, safe; but `controle`,
     localized keys, etc.).
   - `tier` → `frontier`, `tier` used for non-auth ranking.
   A standard OIDC ID token (Auth0, Cognito, Google) frequently carries
   `https://.../roles`, `role`, or a `plan`/`subscription` custom claim
   legitimately and by design — flagging those HIGH on every site that uses
   a mainstream IdP is a systematic false positive, not an edge case.

Severity of the impact: this is a passive scanner; a false HIGH is a
report-quality / trust problem (alert fatigue, users distrusting the tool),
not a security hole in VibeSafe. The finding text is also somewhat hedged
("If the client trusts these claims..."). So real, but Low.

How to fix it:
- Anchor/word-boundary the key match so it matches whole-ish claim names,
  not substrings: e.g. test each key with
  `/^(role|roles|tier|plan|premium|admin|is_pro|subscription|acct_level)$/i`
  or split on `_`/`.`/`-` and match tokens, instead of a free substring.
- Drop the standalone generic `level` token (highest-FP, lowest-signal) or
  require it to co-occur with an auth-ish sibling.
- Lower confidence to `low` (mirroring P1-19's pattern) and/or severity to
  MEDIUM unless the cookie name itself looks session-like, since the module
  cannot tell a forgeable client-trusted token from a normal signed IdP
  token from the payload alone.

────────────────────────────────────────────────────────────────────

FINDING M3 — P1-19 innerHTML regex on minified/semicolon-stripped code
Verdict: CONFIRMED (Low severity — bounded by design; FN on minified concat, contained FP risk)
File and line: src/lib/scanner/modules/p1-19-dom-xss.ts:78

What it is:
Pattern: `/\.innerHTML\s*=\s*[^;\n]{0,80}?(?:location|document\.referrer)\b/`
The character class `[^;\n]` is what bounds the lazy run between `=` and the
source token. Minifiers (terser/esbuild) DO keep `;` as statement separators
in the default output — they do not strip semicolons (ASI-relying output is
not the default and is rare). So the `;`-stop generally still works on
minified bundles. The realistic failure modes:

False NEGATIVE (the more likely real effect):
- The 80-char cap is small for minified code. Minified concatenation often
  looks like `a.innerHTML=t+e.location.hash+n` (short — fine) but also
  `el.innerHTML=somePrefixVar+wrap(get(window.location.search))+suffixVar`
  which easily exceeds 80 non-`;` chars before the `location` token →
  the pattern silently misses a genuine source→sink. Module confidence is
  already declared `low` and it is explicitly a "high-confidence subset, not
  exhaustive" detector, so an FN here is within stated design intent, but it
  does mean P1-19 will under-detect on exactly the minified bundles it most
  needs to handle.
- Semicolon-free single-expression bundles (IIFE comma-operator / sequence
  expressions, or ASI-minified output) defeat the `;` stop, but `\n` is also
  a stop and the 80-char cap still bounds the run, so the stated risk
  ("spanning two unrelated statements") is contained — it cannot run away
  across a whole file.

False POSITIVE:
- Within 80 chars of an `.innerHTML =`, an incidental token `location` or
  `document.referrer` that is NOT actually flowing into the assignment can
  match (e.g. `x.innerHTML=render(item); trackNav(location.pathname)` on a
  semicolon-free build, or property/string content containing the literal
  word `location`). `\b(?:location|document\.referrer)\b` also matches
  `mylocation`-style? No — `\b` before `location` still allows `geolocation`?
  `geolocation` → `\b` requires a word boundary; `geolocation` has no
  boundary before `location` (letters on both sides), so `geolocation` does
  NOT match — good. But a bare identifier `location` used innocuously WILL
  match. Confidence is `low` and findings are explicitly "confirm in code
  review", which is the correct mitigation for this class.

Why it matters:
This is a heuristic surface-finder with self-declared `confidence: 'low'`
and a 10-finding cap. Both the FP and FN here are inherent to regex-based
DOM-XSS detection and are disclosed in the finding. No security impact on
VibeSafe; the cost is detection quality. Senior reviewer's concern is valid
but correctly Low given the explicit low-confidence framing.

How to fix it (optional, quality improvement — not a blocker):
- Raise the cap to ~160 and add `}` and `,` are deliberately NOT excluded —
  consider also stopping on `<` `>` only if needed; the main lever is the
  cap length vs. minified reality. Pragmatic: bump `{0,80}` to `{0,200}` and
  accept marginally more FP (already low-confidence + review-gated), trading
  the more damaging FN (missed real sink) for cheap, flagged FP.
- Keep `confidence: 'low'` and the human-review wording — that is the right
  control and should not be removed.

────────────────────────────────────────────────────────────────────

FINDING M4 — P1-10 apex extraction breaks on multi-part TLDs
Verdict: CONFIRMED (Medium severity — real correctness bug, causes wrong-domain DNS lookups)
File and line: src/lib/scanner/modules/p1-10-dns-email.ts:25-26

What it is:
```
const parts = hostname.split('.');
const apex = parts.length > 2 ? parts.slice(-2).join('.') : hostname;
```
`slice(-2)` takes the last two labels. For a public-suffix-2 TLD this is
wrong:
- `mail.example.co.uk` → apex = `co.uk` (a public suffix, NOT the
  registrable domain). Correct apex is `example.co.uk`.
- `www.agency.com.au` → `com.au`. Correct: `agency.com.au`.
- `dept.service.gov.uk` → `gov.uk`. Correct: `service.gov.uk`.
- Even `example.co.uk` itself (no subdomain, 3 labels) → `co.uk`.

Why it matters:
Every downstream lookup uses `apex`:
- SPF: `getTxtRecords(apex)` queries TXT for `co.uk` instead of
  `example.co.uk`. `co.uk` has no SPF for the user → P1-10 emits a MEDIUM
  "No SPF record found" with `location: DNS TXT @ co.uk` and a fix prompt
  telling the user to add SPF to `co.uk`. This is a FALSE POSITIVE finding
  with actively misleading remediation (the user cannot and must not add
  records to `co.uk`).
- DMARC: queries `_dmarc.co.uk` — same false "No DMARC record" + a fix
  prompt pointing at `_dmarc.co.uk`.
- DKIM: probes `google._domainkey.co.uk` etc. — all miss, producing the INFO
  "DKIM not confirmed" for the wrong zone.
So for every .co.uk / .com.au / .gov.uk / .co.in / .com.br (etc.) site —
a large fraction of the non-US web — P1-10 produces up to three
wrong-domain findings with remediation that, if followed, is nonsensical.
This is the most user-impacting correctness defect in this batch after C1:
it does not break VibeSafe's security, but it makes the tool emit confidently
wrong security advice, which for a security product is a trust-grade issue.
Medium is the correct severity (no exploit; high false-advice volume).

How to fix it:
Use a Public Suffix List–aware registrable-domain extraction rather than
"last two labels". Options:
- Add `tldts` or `psl` (small, well-maintained) and use
  `getDomain(hostname)` to get the registrable apex.
- If a new dependency is undesirable, ship a curated multi-part-suffix set
  (co.uk, com.au, gov.uk, co.in, com.br, co.jp, …) and, when the last two
  labels are in that set, take the last THREE labels. This is a stopgap and
  will still be wrong for suffixes not in the list — PSL is the correct
  long-term fix.
- Whatever the mechanism: when the registrable domain cannot be determined
  with confidence, the SPF/DMARC "absent" findings should degrade to INFO
  (like the DKIM path already does) rather than asserting MEDIUM
  "No SPF record" against a possibly-wrong zone.

────────────────────────────────────────────────────────────────────

FINDING M5 — P1-07 OPTIONS Allow-Methods check FP from CDN/proxy reflection
Verdict: CONFIRMED (Low severity — real false-positive class, low harm, already MEDIUM)
File and line: src/lib/scanner/modules/p1-07-cors.ts:163-190

What it is:
After an OPTIONS preflight (with `Access-Control-Request-Method: DELETE`),
the module reads `Access-Control-Allow-Methods`, and if it contains
DELETE/PUT/PATCH AND the path does not start with `/api/`, it emits a MEDIUM
"destructive methods allowed on non-API path".

Why it matters (false-positive assessment — the actual question):
The concern is valid. Real FP sources:
- CDNs / WAFs / API gateways (Cloudflare, Akamai, CloudFront, nginx proxy
  layers) frequently answer OPTIONS themselves with a broad, static
  `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`
  regardless of what the origin actually allows for that path. The probe
  then attributes an edge-default policy to "the origin server on a non-API
  path", which is exactly the misattribution the senior reviewer flagged.
- Many frameworks/servers reflect the requested method
  (`Access-Control-Request-Method: DELETE` echoed back into
  `Access-Control-Allow-Methods`) for ANY path, including static HTML routes,
  without that method being functionally handled. Since the probe always
  requests `DELETE`, a reflecting intermediary guarantees a match on every
  non-/api/ path.
- "non-API path" is decided purely by `!path.startsWith('/api/')` — sites
  using `/v1/`, `/graphql`, `/rest/`, or no `/api` prefix at all will have
  genuine API endpoints classified as "non-API", inflating FP further.

Mitigating factors that keep this Low:
- It is emitted as MEDIUM, not HIGH/CRITICAL, with hedged language
  ("unusual and may indicate", "does not appear to be an API endpoint").
- It is advisory; no automated action, no security impact on VibeSafe.
- It is a single finding per URL, and `urlsToProbe` is small in the
  intended design (the unbounded-probe defect is C1, tracked separately).
So: a real, named false-positive class, correctly low-stakes, correctly
already MEDIUM. Not a blocker; worth tightening.

How to fix it (quality improvement — not a blocker):
- Require corroboration before flagging: only emit if the destructive method
  is reflected AND the response is NOT obviously from an intermediary (e.g.
  presence of an origin-app signal), or only when ACAO also reflects the
  forged origin (i.e. an actually-permissive CORS posture), not on
  Allow-Methods alone.
- Detect method-reflection: if `Access-Control-Allow-Methods` exactly equals
  / trivially contains only the single requested `DELETE`, treat it as
  likely reflection and suppress or downgrade to INFO.
- Lower to INFO, or add a `confidence: 'low'` marker (consistent with P1-19),
  given the strong intermediary-misattribution likelihood.

────────────────────────────────────────────────────────────────────

SUMMARY
Critical: 1   (C1 — CONFIRMED, fix not present in file as read; must fix before Phase 5)
High    : 0
Medium  : 1   (M4 — CONFIRMED wrong-domain DNS lookups on multi-part TLDs)
Low     : 4   (M1, M2, M3, M5 — all CONFIRMED as real but low-stakes / quality issues)

Verdict mapping:
- C1  CONFIRMED  — Critical, blocker
- M1  CONFIRMED  — Low (known, browser-prefix-enforced; real HttpOnly FN, schedule fix)
- M2  CONFIRMED  — Low (substring claim regex → systematic FP on mainstream IdP tokens)
- M3  CONFIRMED  — Low (FN on long minified concat; FP contained; low-confidence by design)
- M4  CONFIRMED  — Medium (PSL-unaware apex → wrong-zone SPF/DMARC/DKIM + misleading fixes)
- M5  CONFIRMED  — Low (CDN/proxy Allow-Methods reflection → FP; already MEDIUM/hedged)

Overall verdict: FAIL

Rationale: One CONFIRMED Critical (C1) — an unbounded, attacker-influenceable
outbound-probe loop that breaks the scan under hostile or merely
API-string-dense input — must be fixed before this batch proceeds. The fix is
small and well-understood (real counter + dedupe + hard cap). M4 is a
CONFIRMED Medium that should be remediated in the same fix cycle because it
makes a security product emit confidently wrong remediation for the entire
multi-part-TLD web. M1/M2/M3/M5 are all CONFIRMED real but Low — they are
detection-quality issues with no exploit path against VibeSafe and may be
accepted/scheduled rather than block, provided they are tracked. Recommend
returning to a bounded fix cycle for C1 (mandatory) and M4 (strongly
recommended), with M1/M2/M5 tightening folded in if cheap.
