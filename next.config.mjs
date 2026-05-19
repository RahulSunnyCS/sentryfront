import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,

  // Enable standalone output for Docker
  output: 'standalone',

  // Required for Next.js 14.2.x to call src/instrumentation.ts register().
  // Without this flag, the instrumentation hook is silently ignored and
  // Sentry.init() is never called on the server/edge runtimes.
  experimental: {
    instrumentationHook: true,
  },

  webpack(config, { dev, isServer }) {
    if (dev) {
      config.optimization.minimize = false;
    }

    // Suppress OpenTelemetry/Sentry warnings
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules\/@opentelemetry\/instrumentation/,
          message: /Critical dependency: the request of a dependency is an expression/,
        },
        {
          module: /node_modules\/require-in-the-middle/,
          message: /Critical dependency: require function is used in a way/,
        },
      ];
    }

    return config;
  },
};

// Composition order: withSentryConfig wraps the withNextIntl-resolved config.
// This ensures Sentry sees the fully merged Next.js config (including the
// next-intl rewrites and i18n settings) before applying its own webpack
// transforms and source-map upload plugin.
//
// tunnelRoute is intentionally NOT set: it would create an unauthenticated
// proxy endpoint at a well-known path with no rate limiting — a High-severity
// finding surfaced during Red Team review.
//
// org/project/authToken are read from env vars at build time (CI injects them);
// they are optional at dev time and safe to leave blank.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: {
    name: process.env.SENTRY_RELEASE,
  },
  // Strip sourceMappingURL comments from production client bundles so source
  // map contents are not publicly reachable via the browser.
  hideSourceMaps: true,
  // Remove Sentry SDK logger statements from the client bundle to reduce size.
  disableLogger: true,
  // Suppress verbose Sentry build-time output in CI logs.
  silent: true,
});
