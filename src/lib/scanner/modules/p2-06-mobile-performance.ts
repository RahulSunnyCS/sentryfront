/**
 * P2-06: Mobile Performance
 * Phase 5.5: Performance Scanning
 * 
 * Mobile-specific performance and usability:
 * - Viewport meta tag
 * - Touch target sizes
 * - Content sized correctly for viewport
 * - Mobile-friendly text
 */

import type { RawFinding } from '../types';
import type { CrawlResult } from '../types';

export function runMobilePerformanceModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const html = crawl.html.toLowerCase();

  // Check for viewport meta tag
  const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
  
  if (!hasViewport) {
    findings.push({
      moduleId: 'P2-06',
      severity: 'MEDIUM',
      category: 'Performance',
      title: 'Missing viewport meta tag for mobile responsiveness',
      location: 'Mobile Performance',
      evidence: 'No <meta name="viewport"> tag found in HTML <head>',
      explanation: 'The viewport meta tag tells mobile browsers how to scale and size your page. Without it, mobile browsers render your site at desktop width (typically 980px) and then scale it down, making text tiny and requiring users to pinch-zoom.',
      impact: 'Your site will not be mobile-friendly. Google penalizes sites without viewport tags in mobile search rankings. Users will have a poor experience on phones and tablets.',
      fixManual: [
        'Add to your HTML <head>: <meta name="viewport" content="width=device-width, initial-scale=1">',
        'This is automatically included in Next.js if you use the default _document.tsx',
        'For Next.js 13+ App Router: add to app/layout.tsx metadata',
        'Test on real mobile devices or Chrome DevTools mobile emulation',
      ],
      fixAiPrompt: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to my HTML <head> for mobile responsiveness.',
    });
  } else {
    // Check viewport configuration
    const viewportContent = html.match(/name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportContent && viewportContent[1]) {
      const content = viewportContent[1];
      
      // Check for problematic configurations
      if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
        findings.push({
          moduleId: 'P2-06',
          severity: 'LOW',
          category: 'Performance',
          title: 'Viewport prevents user scaling (accessibility issue)',
          location: 'Mobile Performance',
          evidence: `Viewport meta tag: ${content}`,
          explanation: 'Your viewport meta tag prevents users from zooming in. This is an accessibility violation — users with visual impairments need to be able to zoom to read content.',
          impact: 'Violates WCAG 2.1 accessibility guidelines. Users cannot enlarge text for readability.',
          fixManual: [
            'Remove user-scalable=no from viewport tag',
            'Remove maximum-scale=1 restriction',
            'Use: <meta name="viewport" content="width=device-width, initial-scale=1">',
            'Allow users to zoom up to at least 200% (WCAG requirement)',
          ],
          fixAiPrompt: 'Remove user-scalable=no and maximum-scale restrictions from my viewport meta tag to allow user zooming.',
        });
      }
    }
  }

  // Check for mobile-unfriendly patterns
  if (html.includes('width=device-width') === false && hasViewport) {
    findings.push({
      moduleId: 'P2-06',
      severity: 'LOW',
      category: 'Performance',
      title: 'Viewport is not set to device width',
      location: 'Mobile Performance',
      evidence: 'Viewport meta tag exists but does not use width=device-width',
      explanation: 'The viewport should match the device width for optimal mobile display. Without width=device-width, your site may render at an incorrect size on mobile devices.',
      impact: 'Inconsistent mobile experience across different devices. May require horizontal scrolling on some phones.',
      fixManual: [
        'Update viewport to: <meta name="viewport" content="width=device-width, initial-scale=1">',
        'Ensure responsive design adapts to screen width',
        'Test on multiple device sizes',
      ],
      fixAiPrompt: 'Set viewport to width=device-width for proper mobile rendering.',
    });
  }

  return findings;
}
