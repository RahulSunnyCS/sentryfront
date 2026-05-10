/**
 * Mock Performance Data Generator
 * 
 * Generates realistic performance scan data with file-specific audit details
 * for demonstration purposes.
 */

import type { ParsedAudit } from '../scanner/audit-parser';
import type { LighthouseMetrics } from '../scanner/lighthouse';

export function generateMockPerformanceMetrics(): LighthouseMetrics {
  return {
    lcp: 4200,
    fcp: 2100,
    cls: 0.15,
    tbt: 850,
    tti: 8500,
    si: 5200,
    ttfb: 1200,
    performanceScore: 0.42, // 42/100 - needs improvement
    accessibilityScore: null, // Not included in performance demo
    seoScore: null, // Not included in performance demo
    opportunities: generateMockOpportunities(),
    accessibilityViolations: [], // Not included in performance demo
    seoIssues: [], // Not included in performance demo
  };
}

function generateMockOpportunities(): ParsedAudit[] {
  return [
    // 1. Unused JavaScript - HIGH IMPACT
    {
      id: 'unused-javascript',
      title: 'Reduce unused JavaScript',
      description: 'Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity.',
      score: 0.23,
      displayValue: 'Potential savings of 547 KiB',
      type: 'opportunity',
      overallSavingsBytes: 560128,
      overallSavingsMs: 1230,
      items: [
        {
          url: 'https://www.google.com/recaptcha/api.js?render=6LdX...',
          totalBytes: 245678,
          wastedBytes: 206842,
          wastedPercent: 84.2,
        },
        {
          url: 'https://example.com/static/js/main.chunk.js',
          totalBytes: 189234,
          wastedBytes: 145123,
          wastedPercent: 76.7,
        },
        {
          url: 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
          totalBytes: 71234,
          wastedBytes: 68234,
          wastedPercent: 95.8,
        },
        {
          url: 'https://example.com/static/js/vendor.chunk.js',
          totalBytes: 312456,
          wastedBytes: 89234,
          wastedPercent: 28.6,
        },
        {
          url: 'https://www.googletagmanager.com/gtag/js?id=G-...',
          totalBytes: 98765,
          wastedBytes: 50695,
          wastedPercent: 51.3,
        },
      ],
    },
    
    // 2. Modern Image Formats - MEDIUM IMPACT
    {
      id: 'modern-image-formats',
      title: 'Serve images in modern formats',
      description: 'Image formats like WebP and AVIF often provide better compression than PNG or JPEG, which means faster downloads and less data consumption.',
      score: 0.45,
      displayValue: 'Potential savings of 387 KiB',
      type: 'opportunity',
      overallSavingsBytes: 396288,
      overallSavingsMs: 890,
      items: [
        {
          url: 'https://example.com/images/hero-banner.jpg',
          totalBytes: 456789,
          wastedBytes: 182715,
          wastedPercent: 40.0,
        },
        {
          url: 'https://example.com/images/product-showcase.png',
          totalBytes: 234567,
          wastedBytes: 117283,
          wastedPercent: 50.0,
        },
        {
          url: 'https://example.com/images/team-photo.jpg',
          totalBytes: 189234,
          wastedBytes: 66131,
          wastedPercent: 35.0,
        },
        {
          url: 'https://example.com/images/logo-large.png',
          totalBytes: 87654,
          wastedBytes: 30159,
          wastedPercent: 34.4,
        },
      ],
    },
    
    // 3. Render-blocking Resources
    {
      id: 'render-blocking-resources',
      title: 'Eliminate render-blocking resources',
      description: 'Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles.',
      score: 0.31,
      displayValue: 'Potential savings of 670 ms',
      type: 'opportunity',
      overallSavingsMs: 670,
      items: [
        {
          url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700',
          wastedMs: 230,
        },
        {
          url: 'https://example.com/static/css/main.css',
          wastedMs: 180,
        },
        {
          url: 'https://cdn.example.com/bootstrap.min.css',
          wastedMs: 150,
        },
        {
          url: 'https://example.com/static/css/theme.css',
          wastedMs: 110,
        },
      ],
    },
  ];
}

export function generateMockFindings() {
  return [
    {
      moduleId: 'P2-01',
      severity: 'HIGH' as const,
      category: 'Performance',
      title: 'Largest Contentful Paint (LCP) needs improvement',
      location: 'Core Web Vitals',
      evidence: 'LCP: 4.2s (target: <2.5s)',
      explanation: 'LCP measures loading performance. Current: 4.2s, Target: <2.5s for good experience.',
      impact: 'Slow LCP hurts SEO and increases bounce rate.',
      fixManual: ['Optimize largest image/element', 'Preload critical resources', 'Reduce server response time'],
      fixAiPrompt: 'My LCP is 4.2s (target <2.5s). Help optimize.',
    },
    {
      moduleId: 'P2-01',
      severity: 'MEDIUM' as const,
      category: 'Performance',
      title: 'Cumulative Layout Shift (CLS) needs improvement',
      location: 'Core Web Vitals',
      evidence: 'CLS: 0.15 (target: <0.1)',
      explanation: 'CLS measures visual stability. High CLS indicates unexpected layout shifts.',
      impact: 'Poor user experience, elements jumping around.',
      fixManual: ['Add width/height to images', 'Reserve space for ads', 'Avoid inserting content above existing content'],
      fixAiPrompt: 'My CLS is 0.15 (target <0.1). Help fix layout shifts.',
    },
  ];
}
