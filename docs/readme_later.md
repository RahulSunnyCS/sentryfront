# Architecture Notes & Lessons Learned

## Server Components Cannot Use Relative `fetch()` URLs

### What broke
`/report/[id]` rendered a blank error screen: **"Failed to parse URL from /api/v1/scans/..."**

### Root cause
`ReportPage` is a Next.js **server component** (no `'use client'` directive). It called `getScan(id)` from `src/lib/api.ts`, which does:

```ts
const BASE = '/api/v1';
fetch(`${BASE}/scans/${id}`)   // ← relative URL
```

In a browser, `fetch('/api/v1/...')` resolves against `window.location.origin`. On the server, there is no `window.location` — Node.js `fetch` requires a fully-qualified URL (`http://localhost:3000/api/v1/...`).

Next.js throws: `TypeError: Failed to parse URL from /api/v1/scans/<id>`

### Why it worked in the browser but not the server
`src/lib/api.ts` is called from two places:
- `LandingHero` (client component, `'use client'`) → `createScan()` → browser fetch → ✅ works
- `ReportPage` (server component) → `getScan()` → server-side fetch → ❌ crashes

The same function behaves differently depending on where it runs.

### The fix
Server components should **never go through the HTTP layer** to read their own data. Query the database (Prisma) directly:

```ts
// Before (broken in server components)
import { getScan } from '@/lib/api';
const scanData = await getScan(params.id);   // relative fetch — crashes on server

// After (correct)
import { prisma } from '@/lib/prisma';
const scan = await prisma.scan.findUnique({ where: { id }, include: { findings: true } });
```

This is also more efficient — zero network overhead, no HTTP round-trip to yourself.

### Rule of thumb
- `src/lib/api.ts` — **browser-only** (client components, `'use client'`). Uses relative `fetch`.
- Server components → import from `@/lib/prisma` directly.
- Never add `'use client'` to a page just to make `fetch` work — fix the data access pattern instead.

---

## Next.js Dev Mode Still Shows Minified-Looking Code

### What was seen
Browser source view showed compact, hard-to-read JavaScript even in `npm run dev`.

### Root cause
SWC (Next.js's Rust-based compiler) does not minify in dev mode, but it does:
- Remove whitespace between tokens
- Inline small functions
- Rename some internal variables

This is not full minification but looks similar. Vendor bundles (`node_modules`) are always pre-built and always look minified regardless of mode.

### The fix
Added to `next.config.mjs`:

```js
webpack(config, { dev }) {
  if (dev) {
    config.optimization.minimize = false;
  }
  return config;
},
```

This disables Terser/SWC minification in dev webpack passes. Your own source files in `src/` become fully readable. Vendor bundles still look compact — that's expected.

### Also useful
Even before this fix, the **Sources tab** in browser devtools shows original TypeScript via source maps. Look under the `webpack://` tree, not the compiled bundle file.
