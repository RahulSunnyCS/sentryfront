/**
 * Sentry Server-Side Configuration
 * 
 * Captures errors and performance data from Next.js server/API routes.
 * Only active when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',

    // Release attribution — ties events to a specific deploy (git SHA or tag).
    // SENTRY_RELEASE is injected by CI; undefined at dev time, which is fine
    // (Sentry treats missing release as "unknown", not as an error).
    release: process.env.SENTRY_RELEASE,

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production',
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Don't send sensitive data
    beforeSend(event, hint) {
      // Scrub sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['stripe-signature'];
      }
      
      // Scrub sensitive env vars from breadcrumbs/context
      if (event.contexts?.runtime?.env) {
        const env = event.contexts.runtime.env as Record<string, unknown>;
        Object.keys(env).forEach((key) => {
          if (
            key.includes('SECRET') ||
            key.includes('KEY') ||
            key.includes('TOKEN') ||
            key.includes('PASSWORD')
          ) {
            env[key] = '[REDACTED]';
          }
        });
      }
      
      return event;
    },
  });
}
