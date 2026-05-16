# Project Overview

**VibeSafe** (package name `vibesafe`, repo `sentryfront`) is a web quality
platform. A user submits a URL and the app runs a deterministic scan across four
domains, then optionally enriches findings with an LLM:

- **Security** — 18 client-side/passive checks (secrets, headers, TLS, cookies,
  CORS, mixed content, subdomain takeover, etc.)
- **Performance** — Lighthouse Core Web Vitals (LCP, FCP, CLS, TBT, TTFB)
- **Accessibility** — WCAG 2.2 AA subset via Lighthouse + in-house checks
- **SEO** — meta/OG tags, structured data, crawlability, mobile, AI discoverability
