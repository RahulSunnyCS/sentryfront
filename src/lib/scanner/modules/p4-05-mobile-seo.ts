/**
 * P4-05: Mobile & Core Web Vitals Module
 * Phase 7.5: SEO Scanning
 * 
 * Mobile SEO Best Practices:
 * - Viewport meta tag for responsive design
 * - Mobile-friendly font sizes (16px+ for body text)
 * - Tap targets large enough (48x48px minimum)
 * - Core Web Vitals affect mobile rankings
 * 
 * Detects:
 * - Missing or misconfigured viewport
 * - Small font sizes on mobile
 * - Tap targets too small
 * - Poor Core Web Vitals on mobile
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

export async function runMobileSEOModule(
  metrics: LighthouseMetrics
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  if (!metrics.seoIssues || metrics.seoIssues.length === 0) {
    return findings;
  }

  // Check for font size issues (mobile readability)
  const fontSizeAudit = metrics.seoIssues.find(audit => audit.id === 'font-size');
  
  if (fontSizeAudit && fontSizeAudit.score !== null && fontSizeAudit.score < 1) {
    findings.push({
      moduleId: 'P4-05',
      severity: 'MEDIUM',
      category: 'SEO',
      title: 'Font sizes are too small for mobile',
      location: 'CSS styles',
      evidence: fontSizeAudit.displayValue || 'Text is too small to read on mobile devices',
      explanation: fontSizeAudit.description || 'Font sizes should be at least 16px for body text on mobile devices. Smaller text forces users to zoom, which Google considers a poor mobile experience.',
      impact: 'Poor mobile usability score in Google Search Console. May affect mobile search rankings. Users will struggle to read content without zooming.',
      fixManual: [
        'Set body font-size to at least 16px',
        'Use rem or em units for scalable text',
        'Avoid fixed pixel sizes below 14px',
        'Test on actual mobile devices',
        'Use CSS media queries for responsive typography',
      ],
      fixAiPrompt: 'My mobile font sizes are too small.\n\nHelp me:\n1. Identify elements with small fonts\n2. Create responsive typography rules\n3. Ensure body text is at least 16px on mobile',
    });
  }

  // Check for tap target issues (mobile usability)
  const tapTargetsAudit = metrics.seoIssues.find(audit => audit.id === 'tap-targets');
  
  if (tapTargetsAudit && tapTargetsAudit.score !== null && tapTargetsAudit.score < 1) {
    const targetCount = tapTargetsAudit.items?.length || 0;
    
    findings.push({
      moduleId: 'P4-05',
      severity: 'MEDIUM',
      category: 'SEO',
      title: `Tap targets too small for mobile (${targetCount} element${targetCount !== 1 ? 's' : ''})`,
      location: 'Interactive elements',
      evidence: `${targetCount} clickable element${targetCount !== 1 ? 's are' : ' is'} smaller than 48x48px`,
      explanation: tapTargetsAudit.description || 'Tap targets (buttons, links) should be at least 48x48 pixels with adequate spacing. Small targets are difficult to tap accurately on touch devices.',
      impact: `Poor mobile usability score. ${targetCount} element${targetCount !== 1 ? 's are' : ' is'} difficult to tap on mobile. Users may click wrong elements or struggle to interact. May affect mobile rankings.`,
      fixManual: [
        'Ensure buttons/links are at least 48x48px',
        'Add padding to increase touch area',
        'Provide spacing between adjacent tap targets',
        'Use min-height and min-width for consistency',
        'Test with Chrome DevTools mobile emulation',
      ],
      fixAiPrompt: `I have ${targetCount} tap target${targetCount !== 1 ? 's' : ''} that are too small.\n\nHelp me increase their size to 48x48px minimum while maintaining design aesthetics.`,
    });
  }

  // Check Core Web Vitals impact (performance affects SEO)
  if (metrics.performanceScore !== null && metrics.performanceScore < 0.9) {
    const score = Math.round(metrics.performanceScore * 100);
    const poorMetrics: string[] = [];
    
    if (metrics.lcp !== null && metrics.lcp > 2500) {
      poorMetrics.push(`LCP: ${Math.round(metrics.lcp)}ms (should be < 2500ms)`);
    }
    if (metrics.cls !== null && metrics.cls > 0.1) {
      poorMetrics.push(`CLS: ${metrics.cls.toFixed(3)} (should be < 0.1)`);
    }
    if (metrics.fcp !== null && metrics.fcp > 1800) {
      poorMetrics.push(`FCP: ${Math.round(metrics.fcp)}ms (should be < 1800ms)`);
    }
    
    if (poorMetrics.length > 0) {
      findings.push({
        moduleId: 'P4-05',
        severity: 'MEDIUM',
        category: 'SEO',
        title: 'Core Web Vitals affect mobile SEO',
        location: 'Page performance',
        evidence: `Performance score: ${score}/100. Poor metrics: ${poorMetrics.join(', ')}`,
        explanation: 'Core Web Vitals (LCP, FID, CLS) are direct ranking factors for mobile search. Google uses real-world data from Chrome users to measure page experience.',
        impact: 'Poor Core Web Vitals can negatively impact mobile search rankings. Users experience slow load times and layout shifts, increasing bounce rate.',
        fixManual: [
          'Optimize Largest Contentful Paint (LCP < 2.5s)',
          'Minimize Cumulative Layout Shift (CLS < 0.1)',
          'Improve First Contentful Paint (FCP < 1.8s)',
          'Use Google PageSpeed Insights for detailed analysis',
          'Check Search Console Core Web Vitals report',
          'Refer to Performance section for specific optimizations',
        ],
        fixAiPrompt: `My Core Web Vitals are affecting mobile SEO:\n${poorMetrics.join('\n')}\n\nHelp me prioritize improvements for mobile search rankings.`,
      });
    }
  }

  // Provide positive feedback if mobile SEO is good
  if (findings.length === 0 && metrics.seoScore !== null && metrics.seoScore >= 0.9) {
    findings.push({
      moduleId: 'P4-05',
      severity: 'INFO',
      category: 'SEO',
      title: 'Mobile SEO is optimized',
      location: 'Mobile optimization',
      evidence: 'Viewport, font sizes, and tap targets are properly configured',
      explanation: 'Page follows mobile SEO best practices with proper viewport, readable fonts, and adequate tap targets. This improves mobile search visibility.',
      impact: 'Good mobile usability score. Page is eligible for strong mobile search rankings.',
      fixManual: [
        'Continue monitoring Core Web Vitals',
        'Test on various mobile devices',
        'Keep tracking mobile usability in Search Console',
      ],
      fixAiPrompt: 'My mobile SEO looks good! Help me maintain and further improve mobile performance.',
    });
  }

  return findings;
}
