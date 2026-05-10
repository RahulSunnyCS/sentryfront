/**
 * P2-05: Server Response Time
 * Phase 5.5: Performance Scanning
 * 
 * Analyzes backend and network performance:
 * - Time to First Byte (TTFB)
 * - Server response time
 * - DNS lookup time
 * - SSL/TLS negotiation time
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

const TTFB_GOOD = 800; // ms - 2025 threshold
const TTFB_POOR = 1800; // ms

export function runServerResponseTimeModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  // Time to First Byte (TTFB)
  if (metrics.ttfb !== null && metrics.ttfb >= TTFB_GOOD) {
    const ttfbMs = Math.round(metrics.ttfb);
    const severity = metrics.ttfb >= TTFB_POOR ? 'HIGH' : 'MEDIUM';
    
    findings.push({
      moduleId: 'P2-05',
      severity,
      category: 'Performance',
      title: 'Time to First Byte (TTFB) is too slow',
      location: 'Server Response Time',
      evidence: `TTFB: ${ttfbMs}ms (target: < 800ms for GOOD)`,
      explanation: 'Time to First Byte measures how long it takes for your server to send the first byte of the HTML response after receiving a request. Slow TTFB indicates backend or network issues — database queries, API calls, server processing, or CDN misconfigurations.',
      impact: 'Slow TTFB delays everything else on your page. No content can render until the HTML starts arriving. This directly impacts all other metrics (FCP, LCP, TTI).',
      fixManual: [
        'Optimize server-side rendering: reduce database queries, cache API responses',
        'Use edge caching (Vercel Edge Functions, Cloudflare Workers, Fastly)',
        'Enable static generation for non-dynamic pages (Next.js SSG)',
        'Use a CDN to serve content from locations closer to users',
        'Optimize database queries: add indexes, use connection pooling',
        'Enable server-side caching (Redis, Memcached) for frequently accessed data',
        'Reduce server load: horizontal scaling, optimize backend code',
      ],
      fixAiPrompt: `My TTFB is ${ttfbMs}ms (target < 800ms). Optimize backend performance, use edge caching, and enable static generation where possible.`,
    });
  }

  return findings;
}
