# Hardcoded / Mock Data Tracker

This file tracks every place in the codebase that uses static demo data instead of real API / database values.
Remove or replace each entry once the relevant backend integration is in place.

---

## Dashboard — `src/app/dashboard/page.tsx`

### `STATS` array (lines ~20–30)
Hardcoded summary cards shown at the top of the dashboard.

```ts
const STATS = [
  { value: '24', label: 'Total scans',     trend: '↑ 12% from last month', tone: 'neutral' },
  { value: '7',  label: 'Critical issues', trend: '↑ 3 from last week',    tone: 'danger'  },
  { value: 'B',  label: 'Avg. grade',      trend: 'Stable',                tone: 'neutral' },
  { value: '3',  label: 'Monitored sites', trend: '',                      tone: 'neutral' },
];
```

**Replace with:** API call to `/api/v1/dashboard/stats` (or equivalent) keyed by user session.

---

### `SCANS` array (lines ~35–50)
Hardcoded scan history rows shown in the table / mobile cards.

```ts
const SCANS: ScanRow[] = [
  { id: 'demo', url: 'taskflow.app',   grade: 'D', score: 35, critical: 2, high: 4, medium: 3, scannedAt: '2 hours ago' },
  { id: 'demo', url: 'mycompany.io',   grade: 'B', score: 82, critical: 0, high: 1, medium: 2, scannedAt: 'Yesterday'   },
  { id: 'demo', url: 'secure-app.com', grade: 'A', score: 94, critical: 0, high: 0, medium: 1, scannedAt: '3 days ago'  },
];
```

**Replace with:** API call to `/api/v1/scans?userId=…` returning paginated scan history.

---

## Verify page — `src/app/verify/page.tsx`

### `domain` and `token` props (line ~50)
The `<VerifyFlow>` component is rendered with static values:

```tsx
<VerifyFlow domain="taskflow.app" token="vibesafe-verify=a7f3c2e1d4b8" />
```

**Replace with:** Values passed from URL search params (`?domain=…`) or from the user's current scan context, with the token fetched from `/api/v1/verify/token?domain=…`.

---

## Active Test flow — `src/app/active-test/active-test-flow.tsx`

### Target domain (Step 1 default / Step 2 display)
The domain `"taskflow.app"` appears as default/placeholder text in the target input and is carried through the steps.

**Replace with:** Controlled state bound to the user's actual input field.

### `CONFIRMED_FINDINGS` array (Step 5)
Two hardcoded findings shown after the simulated scan:

```ts
const CONFIRMED_FINDINGS = [
  { id: 'sqli-1', type: 'SQL Injection', ... },
  { id: 'xss-1',  type: 'Stored XSS',   ... },
];
```

**Replace with:** Response from `/api/v1/active-test/:scanId/results`.

### `PASSED` array (Step 5)
List of passed checks shown below findings:

```ts
const PASSED = [
  'No open redirects detected',
  'CORS policy: strict origin',
  ...
];
```

**Replace with:** Part of the scan results API response above.

### Progress simulation (Step 4)
`setInterval`-driven fake progress with hardcoded probe labels.

**Replace with:** Server-Sent Events or polling against `/api/v1/active-test/:scanId/progress`.

---

## Landing page — `src/app/landing-hero.tsx`

### Live scan counter
The "scans run" counter displays a static starting number and increments locally via `setInterval`.

**Replace with:** Fetch real count from `/api/v1/stats/scan-count` on mount, then optionally increment locally for UX.

---

## Report demo — `src/app/report/demo/`

All findings, grade, score, and metadata on the `/report/demo` route are static demo fixtures.

**Replace with:** Real scan data fetched by scan ID from `/api/v1/report/:scanId`.

---

*Last updated: 2026-05-13*
