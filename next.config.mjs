/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,

  // Enable standalone output for Docker
  output: 'standalone',

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

export default nextConfig;
