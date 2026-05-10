/**
 * P2-02: Resource Optimization
 * Phase 5.5: Performance Scanning
 * 
 * Detects inefficient resource usage:
 * - Uncompressed images (should use WebP/AVIF)
 * - Unminified JavaScript and CSS
 * - Unused JavaScript (code splitting opportunities)
 * - Render-blocking resources
 */

import type { RawFinding } from '../types';
import type { LighthouseMetrics } from '../lighthouse';

const SIGNIFICANT_WASTE_BYTES = 500 * 1024; // 500 KB
// const MINOR_WASTE_BYTES = 100 * 1024; // 100 KB (reserved for future use)

export function runResourceOptimizationModule(metrics: LighthouseMetrics): RawFinding[] {
  const findings: RawFinding[] = [];

  // Process each optimization opportunity from Lighthouse
  for (const opportunity of metrics.opportunities) {
    const wastedKB = opportunity.overallSavingsBytes ? Math.round(opportunity.overallSavingsBytes / 1024) : 0;
    const wastedMs = opportunity.overallSavingsMs ? Math.round(opportunity.overallSavingsMs) : 0;

    // Skip if impact is too small
    if (wastedKB < 50 && wastedMs < 100) continue;

    // Determine severity based on wasted bytes/time
    let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (opportunity.overallSavingsBytes && opportunity.overallSavingsBytes >= SIGNIFICANT_WASTE_BYTES) {
      severity = 'MEDIUM';
    } else if (wastedMs >= 500) {
      severity = 'MEDIUM';
    }

    // Modern image formats
    if (opportunity.id === 'modern-image-formats') {
      findings.push({
        moduleId: 'P2-02',
        severity,
        category: 'Performance',
        title: 'Serve images in modern formats (WebP, AVIF)',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB could be saved by using modern image formats`,
        explanation: 'WebP and AVIF image formats provide superior compression compared to JPEG and PNG — typically 25-35% smaller file sizes with no visible quality loss. Serving modern formats speeds up page load and reduces bandwidth costs.',
        impact: `Potential savings: ${wastedKB} KB of image data. Faster LCP, lower bandwidth usage, improved user experience on slow connections.`,
        fixManual: [
          'Convert images to WebP using tools like Squoosh, ImageMagick, or cwebp CLI',
          'Use <picture> element with multiple formats: <source srcset="image.avif" type="image/avif">',
          'Set up automatic image optimization in your build pipeline (Next.js Image Optimization, Cloudinary, Imgix)',
          'Use next/image component which automatically serves WebP when supported',
        ],
        fixAiPrompt: `I'm serving ${wastedKB} KB of images in JPEG/PNG. Convert them to WebP/AVIF and implement <picture> with fallbacks.`,
      });
    }

    // Unused JavaScript
    if (opportunity.id === 'unused-javascript') {
      findings.push({
        moduleId: 'P2-02',
        severity,
        category: 'Performance',
        title: 'Reduce unused JavaScript',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB of unused JavaScript detected`,
        explanation: 'Your JavaScript bundles contain code that is never executed on this page. Unused code increases download time, parse time, and compile time — slowing down the entire page load.',
        impact: `Potential savings: ${wastedKB} KB. Reducing unused JS improves FCP, LCP, and TBT by reducing parse/compile time.`,
        fixManual: [
          'Implement code splitting: use dynamic imports for routes and features',
          'Remove unused npm packages and dead code',
          'Use tree-shaking (ensure ES6 modules, not CommonJS)',
          'Lazy load non-critical features (modals, charts, heavy components)',
          'Analyze bundle with webpack-bundle-analyzer or Next.js bundle analysis',
        ],
        fixAiPrompt: `I have ${wastedKB} KB of unused JavaScript. Implement code splitting, remove dead code, and lazy load non-critical features.`,
      });
    }

    // Render-blocking resources
    if (opportunity.id === 'render-blocking-resources') {
      findings.push({
        moduleId: 'P2-02',
        severity: 'MEDIUM',
        category: 'Performance',
        title: 'Eliminate render-blocking resources',
        location: 'Resource Optimization',
        evidence: `${wastedMs}ms delay caused by render-blocking CSS and JavaScript`,
        explanation: 'Render-blocking resources (CSS and synchronous JavaScript in <head>) prevent the browser from displaying content until they finish downloading and parsing. This delays FCP and LCP.',
        impact: `Potential savings: ${wastedMs}ms. Deferring render-blocking resources improves FCP and perceived load speed.`,
        fixManual: [
          'Inline critical CSS directly in <head> (extract with tools like Critical or Critters)',
          'Defer non-critical CSS: <link rel="preload" as="style" onload="this.rel=\'stylesheet\'">',
          'Move non-critical JavaScript to end of <body> or use defer/async attributes',
          'Remove unused CSS with PurgeCSS or UnCSS',
        ],
        fixAiPrompt: `I have ${wastedMs}ms of render-blocking resources. Inline critical CSS, defer non-critical styles, and use async/defer for JavaScript.`,
      });
    }

    // Unminified JavaScript
    if (opportunity.id === 'unminified-javascript') {
      findings.push({
        moduleId: 'P2-02',
        severity: 'LOW',
        category: 'Performance',
        title: 'Minify JavaScript',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB could be saved by minifying JavaScript`,
        explanation: 'Minification removes whitespace, comments, and shortens variable names in JavaScript files. This is a basic optimization that should always be enabled in production.',
        impact: `Potential savings: ${wastedKB} KB. Minified JS downloads faster and parses faster.`,
        fixManual: [
          'Enable minification in your build tool (Webpack, Vite, Next.js automatically minifies in production)',
          'Verify NODE_ENV=production is set during build',
          'Use Terser or SWC for JavaScript minification',
        ],
        fixAiPrompt: `I have ${wastedKB} KB of unminified JavaScript. Enable minification in my build process.`,
      });
    }

    // Unminified CSS
    if (opportunity.id === 'unminified-css') {
      findings.push({
        moduleId: 'P2-02',
        severity: 'LOW',
        category: 'Performance',
        title: 'Minify CSS',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB could be saved by minifying CSS`,
        explanation: 'Minification removes whitespace and comments from CSS files. This basic optimization should always be enabled in production builds.',
        impact: `Potential savings: ${wastedKB} KB. Faster CSS downloads and parsing.`,
        fixManual: [
          'Enable CSS minification in your build tool (postcss-csso, cssnano, clean-css)',
          'Verify production build process includes CSS optimization',
          'Next.js automatically minifies CSS in production mode',
        ],
        fixAiPrompt: `I have ${wastedKB} KB of unminified CSS. Enable CSS minification in my build configuration.`,
      });
    }

    // Optimized images (compression)
    if (opportunity.id === 'uses-optimized-images') {
      findings.push({
        moduleId: 'P2-02',
        severity,
        category: 'Performance',
        title: 'Properly size and compress images',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB could be saved by compressing images`,
        explanation: 'Your images are not optimally compressed. Even in JPEG/PNG format, images should be compressed to reduce file size without visible quality loss.',
        impact: `Potential savings: ${wastedKB} KB. Compressed images load faster, especially on mobile connections.`,
        fixManual: [
          'Compress images with tools like TinyPNG, Squoosh, ImageOptim, or jpegoptim',
          'Use image CDN with automatic compression (Cloudinary, Imgix, Cloudflare Images)',
          'Set appropriate quality levels (80-85 for JPEG is usually imperceptible)',
          'Use next/image which automatically optimizes images',
        ],
        fixAiPrompt: `I can save ${wastedKB} KB by compressing images. Set up automatic image optimization with next/image or an image CDN.`,
      });
    }

    // Responsive images
    if (opportunity.id === 'uses-responsive-images') {
      findings.push({
        moduleId: 'P2-02',
        severity,
        category: 'Performance',
        title: 'Serve appropriately sized images',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB wasted by serving oversized images`,
        explanation: 'Your images are larger than necessary for the display size. Mobile users are downloading desktop-sized images, wasting bandwidth and slowing down load time.',
        impact: `Potential savings: ${wastedKB} KB. Mobile users will see faster load times with properly sized images.`,
        fixManual: [
          'Use srcset and sizes attributes to serve different image sizes for different screens',
          'Generate multiple image sizes at build time (320w, 640w, 1024w, 1920w)',
          'Use next/image which automatically generates responsive images',
          'Implement art direction with <picture> element for different crops on mobile vs desktop',
        ],
        fixAiPrompt: `I'm serving oversized images (${wastedKB} KB wasted). Implement responsive images with srcset and sizes attributes.`,
      });
    }

    // Offscreen images (lazy loading)
    if (opportunity.id === 'offscreen-images') {
      findings.push({
        moduleId: 'P2-02',
        severity: 'LOW',
        category: 'Performance',
        title: 'Lazy load offscreen images',
        location: 'Resource Optimization',
        evidence: `${wastedKB} KB of images below the fold could be lazy loaded`,
        explanation: 'Images that are not visible on initial page load (below the fold) should be lazy loaded. This reduces initial page weight and improves LCP.',
        impact: `Potential savings: ${wastedKB} KB. Lazy loading defers image downloads until users scroll, improving initial load performance.`,
        fixManual: [
          'Add loading="lazy" attribute to images below the fold: <img loading="lazy" src="...">',
          'Use Intersection Observer API for custom lazy loading logic',
          'Next.js next/image automatically lazy loads images below the fold',
          'Do NOT lazy load hero images or above-the-fold content (harms LCP)',
        ],
        fixAiPrompt: `I have ${wastedKB} KB of offscreen images. Add loading="lazy" to images below the fold.`,
      });
    }
  }

  return findings;
}
