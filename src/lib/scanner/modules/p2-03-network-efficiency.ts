/**
 * P2-03: Network Efficiency
 * Phase 5.5: Performance Scanning
 * 
 * Checks network-level optimizations:
 * - HTTP/2 or HTTP/3 usage
 * - Cache headers on static assets
 * - Text compression (Gzip, Brotli)
 * - Connection efficiency
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export function runNetworkEfficiencyModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const opportunity of metrics.opportunities) {
    const wastedKB = opportunity.overallSavingsBytes ? Math.round(opportunity.overallSavingsBytes / 1024) : 0;

    // Text compression
    if (opportunity.id === 'uses-text-compression' && wastedKB > 50) {
      findings.push({
        moduleId: 'P2-03',
        severity: wastedKB > 500 ? 'MEDIUM' : 'LOW',
        category: 'Performance',
        title: 'Enable text compression (Gzip/Brotli)',
        location: 'Network Efficiency',
        evidence: `${wastedKB} KB could be saved with text compression`,
        explanation: 'Your server is not compressing text-based resources (HTML, CSS, JavaScript, JSON). Gzip or Brotli compression typically reduces text files by 70-80%.',
        impact: `Potential savings: ${wastedKB} KB. Compressed responses download faster, especially on mobile networks.`,
        fixManual: [
          'Enable Gzip compression in your server or CDN (Vercel enables this automatically)',
          'Use Brotli for even better compression (30% smaller than Gzip)',
          'Verify Content-Encoding: gzip or br header is present',
          'For Vercel: automatic. For Nginx: gzip on; gzip_types text/css application/javascript;',
        ],
        fixAiPrompt: `Enable Gzip or Brotli compression to save ${wastedKB} KB of text-based resources.`,
      });
    }

    // Long cache TTL
    if (opportunity.id === 'uses-long-cache-ttl' && wastedKB > 100) {
      findings.push({
        moduleId: 'P2-03',
        severity: 'LOW',
        category: 'Performance',
        title: 'Use efficient cache policy on static assets',
        location: 'Network Efficiency',
        evidence: `${wastedKB} KB of resources could be cached more efficiently`,
        explanation: 'Static assets (JavaScript, CSS, images, fonts) should have long cache lifetimes (1 year) with cache busting via hashed filenames. This allows browsers to reuse cached resources instead of re-downloading.',
        impact: 'Repeat visitors will load pages faster. Reduces bandwidth costs. Improves performance on subsequent page views.',
        fixManual: [
          'Set Cache-Control: public, max-age=31536000, immutable for hashed assets',
          'Use content hashing in filenames (Webpack/Next.js do this automatically)',
          'For HTML: Cache-Control: no-cache to always revalidate',
          'For API responses: Cache-Control: no-store if data is user-specific',
        ],
        fixAiPrompt: `Configure long cache headers (1 year) for ${wastedKB} KB of static assets with hashed filenames.`,
      });
    }

    // HTTP/2
    if (opportunity.id === 'uses-http2') {
      findings.push({
        moduleId: 'P2-03',
        severity: 'LOW',
        category: 'Performance',
        title: 'Serve resources over HTTP/2 or HTTP/3',
        location: 'Network Efficiency',
        evidence: 'Site is not using HTTP/2, which offers better performance',
        explanation: 'HTTP/2 multiplexes multiple requests over a single connection, eliminating the overhead of multiple TCP connections. HTTP/3 (QUIC) further improves performance with 0-RTT connections.',
        impact: 'HTTP/2 reduces latency by 20-50% compared to HTTP/1.1. Especially beneficial for sites with many resources.',
        fixManual: [
          'Enable HTTP/2 in your hosting provider (Vercel, Cloudflare, Netlify support HTTP/2 by default)',
          'Requires HTTPS (HTTP/2 only works over TLS)',
          'For Nginx: listen 443 ssl http2;',
          'Verify via browser DevTools Network tab: Protocol column shows "h2"',
        ],
        fixAiPrompt: 'Enable HTTP/2 or HTTP/3 on my hosting provider to improve request multiplexing.',
      });
    }
  }

  return findings;
}
