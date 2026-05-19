/**
 * Sentry Edge Runtime Configuration
 * 
 * Captures errors from Edge Runtime (middleware, edge API routes).
 * Only active when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Release attribution — ties edge runtime events to a specific deploy.
    // SENTRY_RELEASE is injected by CI; undefined at dev time (harmless).
    release: process.env.SENTRY_RELEASE,

    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
  });
}
