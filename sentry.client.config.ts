/**
 * Sentry Client-Side Configuration
 * 
 * Captures errors and performance data from the browser.
 * Only active when NEXT_PUBLIC_SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENABLED = process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true';

if (SENTRY_ENABLED && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
    
    // Only send errors in production to reduce noise
    enabled: process.env.NODE_ENV === 'production',
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Session Replay (optional, can be disabled for privacy)
    replaysSessionSampleRate: 0.01, // 1% of sessions
    replaysOnErrorSampleRate: 0.1, // 10% of sessions with errors
    
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Don't send sensitive data
    beforeSend(event, hint) {
      // Remove URL search params (might contain tokens)
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          url.search = '';
          event.request.url = url.toString();
        } catch {
          // Invalid URL, leave as-is
        }
      }
      
      return event;
    },
  });
}
