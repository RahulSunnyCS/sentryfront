# Deployment Observability Runbook

This guide covers three operational areas for monitoring VibeSafe in production: **Sentry error tracking**, **log shipping**, and **uptime alerting**. Each section clearly separates what is **already wired in the codebase** from what requires **operator/provider-side configuration**.

## 1. Sentry — Error Tracking & Performance Monitoring

### What is already wired in the codebase

- `src/instrumentation.ts` + `next.config.mjs` (experimental.instrumentationHook) ensure Sentry initializes on the server runtime at startup.
- All three Sentry config files (`sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`) read the configuration from environment variables and call `Sentry.init()`.
- Scans are wrapped in a Sentry span (`scan` operation) which captures:
  - `scan_id` — the VibeSafe scan identifier
  - `tier` — the user's subscription tier
  - `url_hash` — first 8 hex chars of SHA-256(URL), sufficient for operator correlation without exposing the target URL
  - `scan.duration_ms` — measurement sent to Sentry Performance for charting scan execution time
- Errors and warnings are automatically captured via the Sentry SDK integration in `src/lib/logger.ts`.

### What you must configure (operator responsibility)

Set these environment variables in your deployment:

| Environment Variable | Purpose | Required? | Where to get it |
|---|---|---|---|
| **SENTRY_DSN** | Sentry ingest URL for your organization | Yes (if monitoring) | Sentry dashboard → Settings → Client Keys |
| **SENTRY_ENABLED** | Flag to enable/disable Sentry (true/false) | No; defaults to false | You set this |
| **SENTRY_ORG** | Sentry organization slug | Yes (for source maps) | Sentry dashboard → URL bar: `sentry.io/organizations/<ORG>/` |
| **SENTRY_PROJECT** | Sentry project slug | Yes (for source maps) | Sentry dashboard → Project name |
| **SENTRY_RELEASE** | Git SHA or deploy tag (for release attribution) | No; optional | Usually set in CI: `git rev-parse --short HEAD` |
| **SENTRY_AUTH_TOKEN** | Token for source map upload during build | No; optional | Sentry dashboard → Settings → Auth Tokens; scope: `project:releases` |

### What each configuration enables

- **SENTRY_DSN** alone enables basic error and event capture in production.
- **SENTRY_DSN + SENTRY_ENABLED=true** enables server-side error capture and tracing (this is the minimum for observability).
- **+ SENTRY_RELEASE** ties each event to a specific deploy, making it easy to trace a regression to a particular commit or build.
- **+ SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT** (in CI) enables automatic source map upload during the build, so stack traces are readable in Sentry.

### Performance visibility

The scan span emits `scan.duration_ms` which appears in Sentry's **Performance** tab under the 'scan' operation. You can:
- Chart scan duration over time
- Filter by tier to see performance differences between subscription levels
- Set alerts on outlier durations (e.g. a scan that takes 3x longer than baseline)

## 2. Log Shipping

### What is already wired in the codebase

- `src/lib/logger.ts` is the single source of truth for application logs.
- In production (`NODE_ENV === 'production'`), logs are **formatted as JSON** and written to stdout via `console.log()`.
- Each log entry includes:
  - `timestamp` — ISO 8601 format
  - `level` — 'debug', 'info', 'warn', 'error'
  - `message` — the log message
  - `context` — optional structured data (e.g. `scanId`, `userId`, `durationMs`)
  - `error` — optional error details (name, message, stack)
- Scan completion events emit structured logs: `scan_complete` event with fields like `scanId`, `durationMs`, `result` ('complete' / 'timeout' / 'error'), and `tier`.
- Errors are also forwarded to Sentry via the integration in logger.ts.

### What you must configure (operator responsibility — NO code changes needed)

Ship these logs off the container/instance using your infrastructure provider's native tooling. A few common options:

- **Docker logging drivers** — configure your container runtime to forward stdout to a log aggregator (e.g. Docker ECS driver for CloudWatch, splunk-logging-driver, awslogs).
- **Cloudflare Logpush** — if deployed on Vercel or Cloudflare, Logpush can forward application logs to your bucket or SIEM.
- **Datadog agent** — run a sidecar or DaemonSet to collect stdout and forward to Datadog with automatic JSON parsing.
- **Logtail** (BetterStack) — lightweight collector, ships logs to BetterStack where you can search, alert, and graph them.
- **Kubernetes DaemonSet** — if on Kubernetes, a log collector (Fluent Bit, Logstash) can scrape pod logs and forward them to your aggregator.

**Key point:** The application layer is done (JSON to stdout). Choosing a log aggregator and configuring log forwarding is your infrastructure responsibility, not a code change. Each provider has different connection details (API keys, endpoints, bucket names), and that configuration varies by environment — it should not live in the codebase.

## 3. Uptime Alerting

### What is already wired in the codebase

- `/api/health` endpoint (see `src/app/api/health/route.ts`) provides a single HTTP check.
- **HTTP 200** = healthy (all systems green)
- **HTTP 503** = degraded (database offline or required environment variables missing)
- Response body is JSON with detailed health information:

```json
{
  "status": "ok" | "error",
  "timestamp": "2026-05-19T12:34:56.789Z",
  "version": "a1b2c3d",
  "environment": "production",
  "db": {
    "type": "postgres" | "sqlite",
    "status": "ok" | "error",
    "error": "connection refused" (if applicable)
  },
  "queue": "redis" | "in-process",
  "metrics": {
    "active_scans_this_instance": 3
  },
  "env": {
    "status": "ok" | "error",
    "required": {
      "DATABASE_URL": true | false,
      "NEXTAUTH_URL": true | false,
      "NEXTAUTH_SECRET": true | false,
      "PAGESPEED_API_KEY": true | false
    },
    "missing": ["PAGESPEED_API_KEY"] (if applicable)
  },
  "features": { /* feature flag state */ },
  "integrations": { /* which optional services are configured */ }
}
```

- **`metrics.active_scans_this_instance`** — how many scans are currently in-flight on this process. **This is per-instance only**, not cluster-wide. For cluster-wide totals, you need a shared store (e.g. Redis INCR/DECR). See [T-03 Redis cluster-wide metrics](../TODO.md) for context.

### What you must configure (operator responsibility — NO code changes needed)

Point an external uptime monitor at `/api/health` and configure alerting:

1. **Choose a provider:**
   - **BetterStack** — simple uptime checks, statuspage integration, log/log-error webhook support
   - **UptimeRobot** — free tier available, supports 50 monitors
   - **Checkly** — API monitoring and synthetic checks, integrates with Datadog/PagerDuty
   - **Honeycomb / Datadog / New Relic** — overkill for a simple health check, but can be added to their APM setup if you use them for full-stack observability

2. **Configure the check:**
   - URL: `https://<your-domain>/api/health`
   - Method: GET
   - Interval: 30 seconds (or your preference)
   - Timeout: 10 seconds
   - Expected status: 200
   - On failure, alert your on-call team via email, Slack, PagerDuty, etc.

3. **Interpret the response:**
   - HTTP 200 → no action needed
   - HTTP 503 → database offline, missing env vars, or both → page on-call team immediately
   - If the check times out or gets a 5xx error → investigate infrastructure (load balancer, network, instance health)

**Per-instance metrics caveat:** The `active_scans_this_instance` field in the health response counts scans in-flight **on this particular container or process**. If you have 3 instances and each is running 2 scans, the health endpoint on each instance will report `active_scans_this_instance: 2`. For a true cluster-wide total, use Redis or another shared store to INCR/DECR across instances (not yet wired in VibeSafe).

## What is Intentionally Left to the Operator and Why

Sentry configuration (DSN, auth token), log forwarding (provider choice), and uptime alerting (monitor selection) are all **environment-specific decisions** that belong outside the codebase:

1. **Sentry**: Different organizations use different Sentry tenants (US, EU, on-prem). Hard-coding a provider would either expose your Sentry DSN in source or force every environment to use the same organization.
2. **Log shipping**: Operators choose their log aggregator based on existing infrastructure (CloudWatch, Datadog, Logtail, Splunk, etc.). There is no one-size-fits-all; coupling the app to a vendor would force a standard that doesn't exist.
3. **Uptime alerting**: Similarly, on-call teams integrate with PagerDuty, Slack, email, or other notification channels based on their existing incident-response workflow. The health endpoint is vendor-agnostic by design — any HTTP client can poll it.

The codebase provides the **mechanics** (Sentry spans, structured JSON logs, HTTP health check). The operator provides the **integration** (which Sentry project, where logs flow, who gets paged). This separation keeps VibeSafe portable and team-agnostic.

## Quick Checklist for a New Deployment

- [ ] Set `SENTRY_DSN` and `SENTRY_ENABLED=true` in your production environment
- [ ] (Optional) Set `SENTRY_RELEASE` and auth token in CI for source map upload
- [ ] Configure your container runtime or log collector to forward stdout to your chosen log aggregator
- [ ] Point an uptime monitor (BetterStack, UptimeRobot, etc.) at `/api/health` on your production domain
- [ ] Set up alerting so your on-call team is notified when the health check returns HTTP 503

## References

- **Code:** `src/instrumentation.ts`, `src/lib/logger.ts`, `src/lib/scan-worker.ts`, `src/app/api/health/route.ts`
- **Config files:** `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, `next.config.mjs`
- **Environment variables:** see `.env.example` for all Sentry, logging, and monitoring variables
