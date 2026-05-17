/**
 * Performance Improvement Suggestions Generator
 * 
 * Analyzes performance scan results and generates:
 * - Prioritized action plan
 * - AI-ready prompts for automated fixes
 * - Impact/effort estimates
 * - Quick wins vs. long-term improvements
 */

import type { RawFinding } from './types';
import type { LighthouseMetrics } from './lighthouse';
import type { ParsedAudit } from './audit-parser';

export interface ImprovementSuggestion {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  aiPrompt: string; // Ready to use with AI coding assistants
  estimatedImpact: string; // e.g., "Improve LCP by 1-2s"
  estimatedEffort: 'Quick Win (<1 hour)' | 'Medium (1-4 hours)' | 'Large (1-2 days)';
  relatedFindings: string[]; // Finding IDs
}

export interface PerformanceImprovementPlan {
  overallGrade: string;
  overallScore: number;
  summary: string;
  quickWins: ImprovementSuggestion[]; // High impact, low effort
  majorImprovements: ImprovementSuggestion[]; // High impact, high effort
  optimizations: ImprovementSuggestion[]; // Medium/low impact
  aiPromptBundle: string; // Single prompt for all improvements
}

/**
 * Helper: Find opportunity audit by ID
 */
function findOpportunity(metrics: LighthouseMetrics, auditId: string): ParsedAudit | undefined {
  if (!metrics.opportunities || !Array.isArray(metrics.opportunities)) {
    return undefined;
  }
  return metrics.opportunities.find(opp => opp.id === auditId);
}

/**
 * Helper: Generate file-specific details from audit items
 */
function formatAuditFiles(audit: ParsedAudit | undefined, maxFiles = 5): string {
  if (!audit || !audit.items || audit.items.length === 0) {
    return '';
  }

  const fileList = audit.items.slice(0, maxFiles).map((item, index) => {
    const url = item.url || 'Unknown file';
    const fileName = url.split('/').pop() || url;
    const wastedKB = item.wastedBytes ? Math.round(item.wastedBytes / 1024) : null;
    const wastedPercent = item.wastedPercent ? Math.round(item.wastedPercent) : null;

    let detail = `${index + 1}. ${fileName}`;
    if (wastedKB) detail += ` (${wastedKB} KiB wasted`;
    if (wastedPercent) detail += `, ${wastedPercent}% unused`;
    if (wastedKB || wastedPercent) detail += ')';
    detail += `\n   URL: ${url}`;

    return detail;
  }).join('\n');

  const remaining = audit.items.length - maxFiles;
  if (remaining > 0) {
    return `${fileList}\n   ...and ${remaining} more file${remaining > 1 ? 's' : ''}`;
  }

  return fileList;
}

/**
 * Generate comprehensive improvement plan from performance scan results
 */
export function generateImprovementPlan(
  findings: RawFinding[],
  metrics: LighthouseMetrics,
  performanceGrade: string,
  performanceScore: number
): PerformanceImprovementPlan {
  const suggestions: ImprovementSuggestion[] = [];
  
  // ── Quick Wins ──────────────────────────────────────────────────────────────
  
  // 1. Image Optimization (if found)
  const modernImageAudit = findOpportunity(metrics, 'modern-image-formats');
  const optimizedImageAudit = findOpportunity(metrics, 'uses-optimized-images');
  const imageAudit = modernImageAudit || optimizedImageAudit;

  if (imageAudit && imageAudit.items && imageAudit.items.length > 0) {
    const totalSavingsKB = imageAudit.overallSavingsBytes ? Math.round(imageAudit.overallSavingsBytes / 1024) : 0;
    const fileDetails = formatAuditFiles(imageAudit, 3);

    suggestions.push({
      priority: totalSavingsKB > 500 ? 'HIGH' : 'MEDIUM',
      category: 'Images',
      title: `Optimize ${imageAudit.items.length} image${imageAudit.items.length > 1 ? 's' : ''}`,
      description: imageAudit.description || 'Converting to WebP/AVIF can reduce image size by 25-50% with no quality loss.',
      aiPrompt: `I need to optimize these images (total savings: ${totalSavingsKB} KiB):\n\n${fileDetails}\n\nHelp me:\n1. Convert to WebP/AVIF format\n2. Implement <picture> elements with fallbacks\n3. Set up automatic image optimization\n4. Add lazy loading for below-fold images`,
      estimatedImpact: `Save ${totalSavingsKB} KiB, improve LCP by 0.5-2s`,
      estimatedEffort: totalSavingsKB > 500 ? 'Medium (1-4 hours)' : 'Quick Win (<1 hour)',
      relatedFindings: [imageAudit.title],
    });
  }

  // 2. Unused JavaScript (if significant)
  const unusedJsAudit = findOpportunity(metrics, 'unused-javascript');

  if (unusedJsAudit && unusedJsAudit.items && unusedJsAudit.items.length > 0) {
    const totalSavingsKB = unusedJsAudit.overallSavingsBytes ? Math.round(unusedJsAudit.overallSavingsBytes / 1024) : 0;
    const fileDetails = formatAuditFiles(unusedJsAudit, 5);

    suggestions.push({
      priority: 'HIGH',
      category: 'JavaScript',
      title: `Remove unused JavaScript from ${unusedJsAudit.items.length} file${unusedJsAudit.items.length > 1 ? 's' : ''}`,
      description: `${totalSavingsKB} KiB of JavaScript is unused. Code splitting and tree-shaking can dramatically reduce bundle size.`,
      aiPrompt: `I have unused JavaScript (total: ${totalSavingsKB} KiB) in these files:\n\n${fileDetails}\n\nHelp me:\n1. Implement code splitting for route-based chunks\n2. Remove unused dependencies and dead code\n3. Use dynamic imports for heavy components\n4. Enable tree-shaking in my build config`,
      estimatedImpact: `Save ${totalSavingsKB} KiB, improve FCP by 0.3-1s, reduce TBT by 200-500ms`,
      estimatedEffort: 'Medium (1-4 hours)',
      relatedFindings: [unusedJsAudit.title],
    });
  }
  
  // 3. Text Compression (if missing)
  const compressionFindings = findings.filter(f => 
    f.title.toLowerCase().includes('compression') || f.title.toLowerCase().includes('gzip')
  );
  if (compressionFindings.length > 0) {
    suggestions.push({
      priority: 'MEDIUM',
      category: 'Server',
      title: 'Enable text compression (Gzip/Brotli)',
      description: 'Your server is not compressing text assets. Enabling Gzip or Brotli can reduce transfer size by 60-80%.',
      aiPrompt: compressionFindings[0]?.fixAiPrompt || 'Enable Brotli/Gzip compression in your web server (Nginx, Apache, or Next.js middleware).',
      estimatedImpact: 'Reduce page weight by 60-80%, faster FCP',
      estimatedEffort: 'Quick Win (<1 hour)',
      relatedFindings: compressionFindings.map(f => f.title),
    });
  }
  
  // ── Core Web Vitals Issues ──────────────────────────────────────────────────
  
  // 4. LCP Issues
  if (metrics.lcp && metrics.lcp >= 2000) {
    const lcpSeconds = (metrics.lcp / 1000).toFixed(2);
    suggestions.push({
      priority: metrics.lcp >= 4000 ? 'CRITICAL' : 'HIGH',
      category: 'Core Web Vitals',
      title: `Fix Largest Contentful Paint (LCP): ${lcpSeconds}s`,
      description: `LCP measures when your largest element loads. Current: ${lcpSeconds}s, Target: <2.0s`,
      aiPrompt: `My LCP is ${lcpSeconds}s (target <2.0s). Optimize hero image, preload critical resources, reduce server response time, eliminate render-blocking CSS/JS.`,
      estimatedImpact: 'Improve Google ranking, reduce bounce rate by 10-30%',
      estimatedEffort: 'Medium (1-4 hours)',
      relatedFindings: findings.filter(f => f.title.includes('LCP')).map(f => f.title),
    });
  }
  
  // 5. CLS Issues
  if (metrics.cls && metrics.cls >= 0.08) {
    suggestions.push({
      priority: metrics.cls >= 0.25 ? 'HIGH' : 'MEDIUM',
      category: 'Core Web Vitals',
      title: `Fix Cumulative Layout Shift (CLS): ${metrics.cls.toFixed(3)}`,
      description: `CLS measures visual stability. Current: ${metrics.cls.toFixed(3)}, Target: <0.08`,
      aiPrompt: `My CLS is ${metrics.cls.toFixed(3)} (target <0.08). Add explicit width/height to images, reserve space for ads/embeds, avoid inserting content above existing content.`,
      estimatedImpact: 'Improve user experience, prevent accidental clicks',
      estimatedEffort: 'Quick Win (<1 hour)',
      relatedFindings: findings.filter(f => f.title.includes('CLS')).map(f => f.title),
    });
  }

  // 6. TBT/JavaScript Performance
  if (metrics.tbt && metrics.tbt >= 200) {
    const tbtMs = Math.round(metrics.tbt);
    suggestions.push({
      priority: metrics.tbt >= 600 ? 'HIGH' : 'MEDIUM',
      category: 'JavaScript Performance',
      title: `Reduce Total Blocking Time (TBT): ${tbtMs}ms`,
      description: `TBT measures main thread blocking. Current: ${tbtMs}ms, Target: <200ms`,
      aiPrompt: `My TBT is ${tbtMs}ms (target <200ms). Split long tasks, defer third-party scripts, reduce JavaScript execution time, use web workers for heavy computations.`,
      estimatedImpact: 'Improve interactivity, faster Time to Interactive',
      estimatedEffort: 'Medium (1-4 hours)',
      relatedFindings: findings.filter(f => f.title.includes('TBT') || f.title.includes('blocking')).map(f => f.title),
    });
  }

  // 7. Server Response Time (TTFB)
  if (metrics.ttfb && metrics.ttfb >= 600) {
    const ttfbMs = Math.round(metrics.ttfb);
    suggestions.push({
      priority: metrics.ttfb >= 1000 ? 'HIGH' : 'MEDIUM',
      category: 'Server Performance',
      title: `Improve Time To First Byte (TTFB): ${ttfbMs}ms`,
      description: `TTFB measures server response time. Current: ${ttfbMs}ms, Target: <600ms`,
      aiPrompt: `My TTFB is ${ttfbMs}ms (target <600ms). Use CDN, enable edge caching, optimize database queries, implement server-side caching (Redis), reduce API round trips.`,
      estimatedImpact: 'Faster initial load, better FCP and LCP',
      estimatedEffort: 'Large (1-2 days)',
      relatedFindings: findings.filter(f => f.title.includes('TTFB') || f.title.includes('server')).map(f => f.title),
    });
  }

  // ── Categorize suggestions ──────────────────────────────────────────────────

  const quickWins = suggestions.filter(s => s.estimatedEffort === 'Quick Win (<1 hour)');
  const majorImprovements = suggestions.filter(s =>
    s.estimatedEffort !== 'Quick Win (<1 hour)' &&
    (s.priority === 'CRITICAL' || s.priority === 'HIGH')
  );
  const optimizations = suggestions.filter(s =>
    s.estimatedEffort !== 'Quick Win (<1 hour)' &&
    s.priority !== 'CRITICAL' && s.priority !== 'HIGH'
  );

  // ── Generate summary ─────────────────────────────────────────────────────────

  let summary = '';
  if (performanceScore >= 90) {
    summary = 'Excellent performance! Minor optimizations can push you to 100%.';
  } else if (performanceScore >= 75) {
    summary = 'Good performance, but there\'s room for improvement. Focus on Core Web Vitals.';
  } else if (performanceScore >= 50) {
    summary = 'Moderate performance. Addressing key issues will significantly improve user experience.';
  } else {
    summary = 'Performance needs attention. Prioritize critical issues for maximum impact.';
  }

  // ── Generate AI Prompt Bundle ────────────────────────────────────────────────

  const aiPromptBundle = generateAIPromptBundle(suggestions, metrics, performanceGrade, performanceScore);

  return {
    overallGrade: performanceGrade,
    overallScore: performanceScore,
    summary,
    quickWins,
    majorImprovements,
    optimizations,
    aiPromptBundle,
  };
}

/**
 * Generate a single comprehensive AI prompt for all improvements.
 *
 * @param score  The already-converted 0-100 integer performance score (the single *100
 *               conversion happens in performance.ts — this function must NOT re-multiply
 *               metrics.performanceScore by 100 again).
 */
function generateAIPromptBundle(
  suggestions: ImprovementSuggestion[],
  metrics: LighthouseMetrics,
  grade: string,
  score: number,
): string {
  const prompt = `# Performance Optimization Request

## Current Performance
- **Grade**: ${grade}
- **Lighthouse Score**: ${score}/100
- **LCP**: ${metrics.lcp ? (metrics.lcp / 1000).toFixed(2) : 'N/A'}s (target: <2.0s)
- **CLS**: ${metrics.cls !== null ? metrics.cls.toFixed(3) : 'N/A'} (target: <0.08)
- **TBT**: ${metrics.tbt ? Math.round(metrics.tbt) : 'N/A'}ms (target: <200ms)
- **FCP**: ${metrics.fcp ? (metrics.fcp / 1000).toFixed(2) : 'N/A'}s (target: <1.5s)
- **TTFB**: ${metrics.ttfb ? Math.round(metrics.ttfb) : 'N/A'}ms (target: <600ms)

## Issues to Fix (Priority Order)

${suggestions.map((s, i) => `
### ${i + 1}. ${s.title} [${s.priority}]
**Category**: ${s.category}
**Impact**: ${s.estimatedImpact}
**Effort**: ${s.estimatedEffort}

**Action**:
${s.aiPrompt}
`).join('\n')}

## Instructions
Please help me implement these improvements. Start with Quick Wins for immediate impact, then tackle major improvements. Provide code examples and configuration changes where applicable.
`;

  return prompt;
}
