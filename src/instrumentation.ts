/**
 * Next.js Instrumentation Hook
 *
 * This file is the single entry-point that Next.js calls once per runtime
 * when the server process starts. It is the only supported way to load
 * Sentry.init() reliably in Next.js 14.2.x App Router (v8 SDK).
 *
 * Without this file (and the matching experimental.instrumentationHook flag
 * in next.config.mjs), sentry.server.config.ts and sentry.edge.config.ts are
 * never imported at runtime, so server-side error capture and tracing are
 * effectively dead in production.
 *
 * Path resolution: this file lives at src/instrumentation.ts, one level
 * below the repo root. The sentry config files live at the repo root
 * (e.g. <root>/sentry.server.config.ts), so the correct relative path
 * from src/ is '../sentry.server.config'.
 */

export async function register() {
  // Next.js sets NEXT_RUNTIME before calling register(), so we can
  // conditionally load the correct Sentry init for each runtime.
  // Using dynamic import (not require) so this stays compatible with
  // both the Edge runtime (which doesn't have require) and the Node
  // runtime, and so the import is deferred until register() is called
  // rather than at module-load time.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
