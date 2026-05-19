/**
 * Sentry Server-Side Configuration
 *
 * Captures errors and performance data from Next.js server/API routes.
 * Only active when SENTRY_DSN is set.
 */

import * as Sentry from '@sentry/nextjs';
import type { TransactionEvent } from '@sentry/core';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true';

/**
 * Redacts the path, query string, and fragment from any http(s) URL found in a
 * string, replacing them with /[redacted].  The scheme+host is kept intentionally:
 * it lets us see *which* target site caused a failure without exposing the
 * sensitive path, query parameters, or tokens that users may embed in the URL.
 * Full removal would make debugging scan failures impossible; origin-only is the
 * minimum necessary for debugging while honouring the data-minimisation principle.
 *
 * The regex is anchored to the URL start (https?://) and stops at the first
 * whitespace or end-of-string, so it handles embedded URLs in longer messages.
 * It is null/undefined-safe and is a no-op when no URL is present.
 */
function redactUrls(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  // Capture: (1) scheme+host  (2) everything after host up to whitespace/end
  return value.replace(
    /(https?:\/\/[^/?#\s]+)([^?\s#]*(?:\?[^\s#]*)?(?:#[^\s]*)?)/gi,
    '$1/[redacted]',
  );
}

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

      // Scrub scanned target URLs from exception messages.
      // Playwright/fetch errors thrown against a scanned site embed the full
      // target URL in the exception value and stack; strip the path/query.
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (typeof ex.value === 'string') {
            ex.value = redactUrls(ex.value) ?? ex.value;
          }
        }
      }

      // Scrub scanned target URLs from breadcrumbs (message and shallow data).
      // HTTP-client instrumentation records the outgoing request URL in both
      // the breadcrumb message and in data.url / data.http.url.
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (typeof crumb.message === 'string') {
            crumb.message = redactUrls(crumb.message) ?? crumb.message;
          }
          if (crumb.data) {
            // Only scrub top-level string values — do not deep-recurse into
            // arbitrary shapes; that risks breaking structured breadcrumb data.
            for (const k of Object.keys(crumb.data)) {
              if (typeof crumb.data[k] === 'string') {
                crumb.data[k] = redactUrls(crumb.data[k]) ?? crumb.data[k];
              }
            }
          }
        }
      }

      // Scrub the request URL on the event itself (auto-captured by the SDK
      // from the incoming Next.js request context on API route errors).
      if (typeof event.request?.url === 'string') {
        event.request.url = redactUrls(event.request.url) ?? event.request.url;
      }

      return event;
    },

    // beforeSend does NOT fire for transaction/span events — Sentry v8 routes
    // those through beforeSendTransaction instead.  Auto-instrumented HTTP
    // client spans record the full outgoing URL in span.data['http.url'] and
    // span.description; we must scrub both here.
    beforeSendTransaction(event: TransactionEvent) {
      // Redact the transaction name (may be set to the scanned URL in some
      // custom instrumentation paths).
      if (typeof event.transaction === 'string') {
        event.transaction = redactUrls(event.transaction) ?? event.transaction;
      }

      // Redact the request URL captured at the transaction level.
      if (typeof event.request?.url === 'string') {
        event.request.url = redactUrls(event.request.url) ?? event.request.url;
      }

      // Redact http.url and description on every child span.
      // SpanJSON.data is typed as { [key: string]: any } so the key access is
      // safe; we guard the typeof before calling redactUrls to be precise.
      if (event.spans) {
        for (const span of event.spans) {
          if (typeof span.description === 'string') {
            span.description = redactUrls(span.description) ?? span.description;
          }
          if (span.data) {
            if (typeof span.data['http.url'] === 'string') {
              span.data['http.url'] = redactUrls(span.data['http.url']) ?? span.data['http.url'];
            }
            // url (without prefix) is also used by some integrations
            if (typeof span.data['url'] === 'string') {
              span.data['url'] = redactUrls(span.data['url']) ?? span.data['url'];
            }
          }
        }
      }

      return event;
    },
  });
}
