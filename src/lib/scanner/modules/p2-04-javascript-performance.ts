/**
 * P2-04: JavaScript Performance
 * Phase 5.5: Performance Scanning
 * 
 * Analyzes JavaScript execution performance:
 * - Total Blocking Time (TBT)
 * - Long tasks (>50ms)
 * - Heavy third-party scripts
 * - Main thread work
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

const TBT_GOOD = 200; // ms
const TBT_POOR = 600; // ms

export function runJavaScriptPerformanceModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  // Total Blocking Time (already checked in P2-01 but with different focus)
  if (metrics.tbt !== null && metrics.tbt >= TBT_GOOD) {
    const tbtMs = Math.round(metrics.tbt);
    const severity = metrics.tbt >= TBT_POOR ? 'MEDIUM' : 'LOW';
    
    findings.push({
      moduleId: 'P2-04',
      severity,
      category: 'Performance',
      title: 'Excessive JavaScript execution time blocks main thread',
      location: 'JavaScript Performance',
      evidence: `Total Blocking Time: ${tbtMs}ms (target: < 200ms)`,
      explanation: 'Your JavaScript is blocking the main thread for too long. Long-running JavaScript tasks prevent the browser from responding to user interactions like clicks, taps, and keyboard input. This makes your site feel sluggish and unresponsive.',
      impact: 'Users experience delays when clicking buttons, typing in forms, or scrolling. This directly impacts Interaction to Next Paint (INP), which is replacing First Input Delay as a Core Web Vital in 2026.',
      fixManual: [
        'Break up long JavaScript tasks: split synchronous work into smaller chunks',
        'Use code splitting to load JavaScript on-demand (React.lazy, dynamic imports)',
        'Defer non-critical JavaScript with async or defer attributes',
        'Move CPU-intensive work to Web Workers (parsing, computation, data processing)',
        'Reduce JavaScript payload: remove unused code, optimize dependencies',
        'Use requestIdleCallback() for non-urgent work',
      ],
      fixAiPrompt: `My Total Blocking Time is ${tbtMs}ms (target < 200ms). Break up long JavaScript tasks, defer non-critical scripts, and use Web Workers for heavy computation.`,
    });
  }

  // Time to Interactive (TTI) - measures when page is fully interactive
  if (metrics.tti !== null && metrics.tti > 5000) {
    const ttiSeconds = (metrics.tti / 1000).toFixed(1);
    
    findings.push({
      moduleId: 'P2-04',
      severity: 'MEDIUM',
      category: 'Performance',
      title: 'Time to Interactive (TTI) is too slow',
      location: 'JavaScript Performance',
      evidence: `TTI: ${ttiSeconds}s (target: < 3.8s for mobile)`,
      explanation: 'Time to Interactive measures how long it takes before your page is fully usable — all content loaded, event handlers registered, and page responds to user input within 50ms. Slow TTI means users see content but can\'t interact with it yet.',
      impact: 'Users may click buttons that don\'t work yet, leading to frustration. This is especially problematic on mobile devices with slower CPUs.',
      fixManual: [
        'Reduce JavaScript execution time (minimize, compress, code split)',
        'Eliminate render-blocking scripts in <head>',
        'Defer third-party scripts (analytics, chat widgets, ads) until after page load',
        'Use server-side rendering or static generation to reduce client-side work',
        'Optimize React/Vue component rendering (React.memo, lazy loading)',
      ],
      fixAiPrompt: `My Time to Interactive is ${ttiSeconds}s. Reduce JavaScript execution time, defer third-party scripts, and optimize client-side rendering.`,
    });
  }

  // Speed Index - measures how quickly content is visually displayed
  if (metrics.si !== null && metrics.si > 4300) {
    const siSeconds = (metrics.si / 1000).toFixed(1);
    
    findings.push({
      moduleId: 'P2-04',
      severity: 'LOW',
      category: 'Performance',
      title: 'Speed Index indicates slow visual progress',
      location: 'JavaScript Performance',
      evidence: `Speed Index: ${siSeconds}s (target: < 3.4s for mobile)`,
      explanation: 'Speed Index measures how quickly content is visually populated during page load. A high Speed Index means content appears slowly, making users wait to see meaningful information.',
      impact: 'Users perceive your site as slow even if technical metrics like TTFB are good. Visual progress matters for user experience.',
      fixManual: [
        'Prioritize above-the-fold content (inline critical CSS, preload hero images)',
        'Remove render-blocking JavaScript',
        'Use skeleton screens or loading placeholders for better perceived performance',
        'Optimize web fonts: use font-display: swap and preload fonts',
        'Server-side render or pre-render critical content',
      ],
      fixAiPrompt: `My Speed Index is ${siSeconds}s. Prioritize above-the-fold content, remove render-blocking JS, and use skeleton screens.`,
    });
  }

  return findings;
}
