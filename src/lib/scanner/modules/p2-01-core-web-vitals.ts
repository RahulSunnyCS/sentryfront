/**
 * P2-01: Core Web Vitals
 * Phase 5.5: Performance Scanning
 * 
 * Checks Google's Core Web Vitals metrics (2025 thresholds):
 * - LCP (Largest Contentful Paint): GOOD < 2.0s, NEEDS IMPROVEMENT < 4.0s, POOR ≥ 4.0s
 * - INP (Interaction to Next Paint): GOOD < 150ms, NEEDS IMPROVEMENT < 500ms, POOR ≥ 500ms
 * - CLS (Cumulative Layout Shift): GOOD < 0.08, NEEDS IMPROVEMENT < 0.25, POOR ≥ 0.25
 * - FCP (First Contentful Paint): GOOD < 1.5s, NEEDS IMPROVEMENT < 3.0s, POOR ≥ 3.0s
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

// 2025 Core Web Vitals thresholds (updated from 2024)
const LCP_GOOD = 2000; // ms (was 2500ms)
const LCP_NEEDS_IMPROVEMENT = 4000;

// INP thresholds (replacing FID in 2026, will use when Lighthouse adds native support)
// const INP_GOOD = 150; // ms
// const INP_NEEDS_IMPROVEMENT = 500;

const CLS_GOOD = 0.08; // score (was 0.1)
const CLS_NEEDS_IMPROVEMENT = 0.25;

// FCP thresholds (used for detection below)
// const FCP_GOOD = 1500; // ms
const FCP_NEEDS_IMPROVEMENT = 3000;

// TBT thresholds (proxy for INP, used below)
// const TBT_GOOD = 200; // ms (Total Blocking Time)
const TBT_NEEDS_IMPROVEMENT = 600;

// --- Transparency INFO thresholds ---
// These are the "Poor" band lower bounds for each Core Web Vital.
// We emit a separate INFO finding when a single metric is in the Poor band
// even if the overall blended Lighthouse performance score looks acceptable.
// This is purely informational — it does not add any penalty, does not change
// the severity of any existing finding, and never fires as HIGH.
// The purpose is to surface a specific metric regression to users who might
// otherwise read a mid-range overall score as "mostly fine".
const TRANSPARENCY_LCP_POOR = LCP_NEEDS_IMPROVEMENT; // >= 4000ms → Poor
const TRANSPARENCY_CLS_POOR = CLS_NEEDS_IMPROVEMENT;  // >= 0.25  → Poor
const TRANSPARENCY_FCP_POOR = FCP_NEEDS_IMPROVEMENT;  // >= 3000ms → Poor
const TRANSPARENCY_TBT_POOR = TBT_NEEDS_IMPROVEMENT;  // >= 600ms  → Poor

export function runCoreWebVitalsModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  // LCP - Largest Contentful Paint
  if (metrics.lcp !== null) {
    const lcpSeconds = (metrics.lcp / 1000).toFixed(2);
    
    if (metrics.lcp >= LCP_NEEDS_IMPROVEMENT) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'HIGH',
        category: 'Performance',
        title: 'Largest Contentful Paint (LCP) is too slow',
        location: 'Core Web Vitals',
        evidence: `LCP: ${lcpSeconds}s (target: < 2.0s for GOOD)`,
        explanation: 'LCP measures how long it takes for the largest element on your page (usually a hero image, heading, or text block) to become visible. Slow LCP directly impacts user experience and Google search rankings. Users are likely to abandon slow-loading pages.',
        impact: 'Poor LCP correlates with 20-40% higher bounce rates and lower conversion rates. Google uses LCP as a ranking signal — slow pages rank lower in search results.',
        fixManual: [
          'Optimize your largest image: convert to WebP/AVIF, compress, use responsive images with srcset',
          'Eliminate render-blocking CSS and JavaScript: inline critical CSS, defer non-critical JS',
          'Use a CDN to serve static assets closer to users',
          'Enable server-side rendering (SSR) or static generation for faster initial HTML',
          'Preload critical resources: <link rel="preload" as="image" href="hero.jpg">',
        ],
        fixAiPrompt: `My Largest Contentful Paint is ${lcpSeconds}s (target < 2.0s). Optimize my hero image, eliminate render-blocking resources, and improve server response time.`,
      });
    } else if (metrics.lcp >= LCP_GOOD) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'MEDIUM',
        category: 'Performance',
        title: 'Largest Contentful Paint (LCP) needs improvement',
        location: 'Core Web Vitals',
        evidence: `LCP: ${lcpSeconds}s (target: < 2.0s for GOOD, currently NEEDS IMPROVEMENT)`,
        explanation: 'Your LCP is in the "Needs Improvement" range. While not critically slow, optimizing LCP will improve user experience and search rankings.',
        impact: 'Users may perceive your site as slower than competitors. Google may rank faster sites higher in search results.',
        fixManual: [
          'Compress and optimize your largest visible image',
          'Use modern image formats (WebP, AVIF)',
          'Implement lazy loading for below-fold images',
          'Reduce server response time (TTFB)',
        ],
        fixAiPrompt: `My LCP is ${lcpSeconds}s (needs to be < 2.0s). Help me optimize my largest image and reduce render-blocking resources.`,
      });
    }
  }

  // CLS - Cumulative Layout Shift
  if (metrics.cls !== null) {
    const clsScore = metrics.cls.toFixed(3);
    
    if (metrics.cls >= CLS_NEEDS_IMPROVEMENT) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'MEDIUM',
        category: 'Performance',
        title: 'Cumulative Layout Shift (CLS) is too high',
        location: 'Core Web Vitals',
        evidence: `CLS: ${clsScore} (target: < 0.08 for GOOD)`,
        explanation: 'CLS measures visual stability — how much your page layout shifts unexpectedly as it loads. High CLS is frustrating for users: buttons move as they try to click them, text jumps around while reading.',
        impact: 'Poor CLS damages user experience and trust. Google penalizes high CLS in search rankings. Users may accidentally click wrong elements due to layout shifts.',
        fixManual: [
          'Add explicit width and height attributes to all images and videos',
          'Reserve space for ads, embeds, and dynamic content with min-height or aspect-ratio CSS',
          'Avoid inserting content above existing content (e.g., banners, notifications)',
          'Use font-display: swap carefully — prefer font-display: optional to avoid layout shift',
          'Preload custom fonts: <link rel="preload" as="font" href="font.woff2">',
        ],
        fixAiPrompt: `My Cumulative Layout Shift is ${clsScore} (target < 0.08). Add width/height to images, reserve space for dynamic content, and fix font loading.`,
      });
    } else if (metrics.cls >= CLS_GOOD) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'LOW',
        category: 'Performance',
        title: 'Cumulative Layout Shift (CLS) needs improvement',
        location: 'Core Web Vitals',
        evidence: `CLS: ${clsScore} (target: < 0.08 for GOOD, currently NEEDS IMPROVEMENT)`,
        explanation: 'Your CLS is in the "Needs Improvement" range. Reducing layout shifts will improve user experience.',
        impact: 'Minor layout shifts may frustrate users and impact search rankings.',
        fixManual: [
          'Add width and height to images without explicit dimensions',
          'Reserve space for ads and dynamic content',
          'Optimize web font loading strategy',
        ],
        fixAiPrompt: `My CLS is ${clsScore} (needs to be < 0.08). Help me reduce layout shifts by adding image dimensions and reserving space for dynamic content.`,
      });
    }
  }

  // FCP - First Contentful Paint
  if (metrics.fcp !== null) {
    const fcpSeconds = (metrics.fcp / 1000).toFixed(2);
    
    if (metrics.fcp >= FCP_NEEDS_IMPROVEMENT) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'MEDIUM',
        category: 'Performance',
        title: 'First Contentful Paint (FCP) is too slow',
        location: 'Core Web Vitals',
        evidence: `FCP: ${fcpSeconds}s (target: < 1.5s for GOOD)`,
        explanation: 'FCP measures how long it takes for ANY content (text, image, SVG) to appear on screen. Slow FCP makes users think your site is broken or unresponsive.',
        impact: 'Users may abandon your site before seeing any content. First impressions matter — slow FCP damages perceived performance.',
        fixManual: [
          'Reduce server response time (optimize backend, use edge caching)',
          'Eliminate render-blocking JavaScript and CSS',
          'Inline critical CSS in the <head>',
          'Use server-side rendering or static generation',
        ],
        fixAiPrompt: `My First Contentful Paint is ${fcpSeconds}s (target < 1.5s). Reduce server response time and eliminate render-blocking resources.`,
      });
    }
  }

  // TBT - Total Blocking Time (proxy for INP until Lighthouse adds native INP support)
  if (metrics.tbt !== null) {
    const tbtMs = Math.round(metrics.tbt);

    if (metrics.tbt >= TBT_NEEDS_IMPROVEMENT) {
      findings.push({
        moduleId: 'P2-01',
        severity: 'MEDIUM',
        category: 'Performance',
        title: 'Total Blocking Time (TBT) is too high',
        location: 'Core Web Vitals',
        evidence: `TBT: ${tbtMs}ms (target: < 200ms for GOOD)`,
        explanation: 'TBT measures how long the main thread is blocked by long tasks during page load. High TBT means your page feels sluggish and unresponsive — buttons don\'t click immediately, inputs don\'t respond.',
        impact: 'Users experience delays when interacting with your page. This is a strong proxy for Interaction to Next Paint (INP), which replaces FID in 2026.',
        fixManual: [
          'Break up long JavaScript tasks (use code splitting, lazy loading)',
          'Remove or defer non-critical third-party scripts',
          'Use web workers for CPU-intensive operations',
          'Optimize JavaScript execution time (reduce complexity, avoid blocking work)',
        ],
        fixAiPrompt: `My Total Blocking Time is ${tbtMs}ms (target < 200ms). Break up long JavaScript tasks and defer non-critical scripts.`,
      });
    }
  }

  // --- Transparency INFO findings ---
  // Emitted ADDITIVELY when any individual metric is in the Poor band.
  // These are purely informational: they never replace or change existing findings
  // and are never emitted at severity higher than INFO.
  //
  // Rationale: a blended Lighthouse performance score can look "decent" even when
  // one metric is in the Poor band (e.g. LCP=5000ms but FCP/CLS/TBT are all
  // excellent). Without a per-metric signal a user might read the blended score
  // and not notice the outlier. These INFO findings surface that outlier explicitly.
  //
  // Note: the Poor band for these metrics coincides with the MEDIUM/HIGH thresholds
  // already checked above, so the INFO finding will accompany a MEDIUM/HIGH in most
  // cases. That is intentional — the INFO carries a specific "Poor band" label that
  // is distinct from the main finding's actionable advice.

  if (metrics.lcp !== null && metrics.lcp >= TRANSPARENCY_LCP_POOR) {
    const lcpSec = (metrics.lcp / 1000).toFixed(2);
    findings.push({
      moduleId: 'P2-01',
      severity: 'INFO',
      category: 'Performance',
      title: 'LCP is in the Poor band',
      location: 'Core Web Vitals (Transparency)',
      evidence: `LCP: ${lcpSec}s — Poor threshold: ≥ 4.0s`,
      explanation:
        'Largest Contentful Paint is in the Poor band (≥ 4.0s). ' +
        'Even if the overall Lighthouse score is moderate due to other metrics passing, ' +
        'this individual metric is in the worst category and directly affects user experience.',
      impact:
        'LCP in the Poor band signals users are waiting a long time for the page to ' +
        'look usable. Google uses LCP as a primary Core Web Vitals ranking factor.',
      fixManual: [
        'See the Largest Contentful Paint finding above for detailed fix guidance',
      ],
      fixAiPrompt: `My LCP (${lcpSec}s) is in the Poor band. What are the most impactful fixes?`,
    });
  }

  if (metrics.cls !== null && metrics.cls >= TRANSPARENCY_CLS_POOR) {
    const clsVal = metrics.cls.toFixed(3);
    findings.push({
      moduleId: 'P2-01',
      severity: 'INFO',
      category: 'Performance',
      title: 'CLS is in the Poor band',
      location: 'Core Web Vitals (Transparency)',
      evidence: `CLS: ${clsVal} — Poor threshold: ≥ 0.25`,
      explanation:
        'Cumulative Layout Shift is in the Poor band (≥ 0.25). ' +
        'Even if the overall score is moderate, this level of layout instability ' +
        'causes real frustration: buttons and links move just as users try to interact.',
      impact:
        'Poor CLS harms user trust and causes accidental clicks. ' +
        'Google uses CLS as a primary Core Web Vitals ranking factor.',
      fixManual: [
        'See the Cumulative Layout Shift finding above for detailed fix guidance',
      ],
      fixAiPrompt: `My CLS (${clsVal}) is in the Poor band. What are the most impactful fixes?`,
    });
  }

  if (metrics.fcp !== null && metrics.fcp >= TRANSPARENCY_FCP_POOR) {
    const fcpSec = (metrics.fcp / 1000).toFixed(2);
    findings.push({
      moduleId: 'P2-01',
      severity: 'INFO',
      category: 'Performance',
      title: 'FCP is in the Poor band',
      location: 'Core Web Vitals (Transparency)',
      evidence: `FCP: ${fcpSec}s — Poor threshold: ≥ 3.0s`,
      explanation:
        'First Contentful Paint is in the Poor band (≥ 3.0s). ' +
        'Users see no content at all for over 3 seconds, which causes high abandonment.',
      impact:
        'Poor FCP creates a perception of a broken or unresponsive page before ' +
        'any content appears.',
      fixManual: [
        'See the First Contentful Paint finding above for detailed fix guidance',
      ],
      fixAiPrompt: `My FCP (${fcpSec}s) is in the Poor band. What are the most impactful fixes?`,
    });
  }

  if (metrics.tbt !== null && metrics.tbt >= TRANSPARENCY_TBT_POOR) {
    const tbtMs2 = Math.round(metrics.tbt);
    findings.push({
      moduleId: 'P2-01',
      severity: 'INFO',
      category: 'Performance',
      title: 'TBT is in the Poor band',
      location: 'Core Web Vitals (Transparency)',
      evidence: `TBT: ${tbtMs2}ms — Poor threshold: ≥ 600ms`,
      explanation:
        'Total Blocking Time is in the Poor band (≥ 600ms). ' +
        'The main thread is heavily blocked, making the page feel unresponsive for ' +
        'an extended period. This is a strong predictor of a poor INP score.',
      impact:
        'Poor TBT means users experience significant input delay during page load. ' +
        'INP (the 2026 CWV replacement for FID) will be directly harmed.',
      fixManual: [
        'See the Total Blocking Time finding above for detailed fix guidance',
      ],
      fixAiPrompt: `My TBT (${tbtMs2}ms) is in the Poor band. What are the most impactful fixes?`,
    });
  }

  return findings;
}
