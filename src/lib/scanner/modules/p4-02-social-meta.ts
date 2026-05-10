/**
 * P4-02: Open Graph & Social Media Module
 * Phase 7.5: SEO Scanning
 * 
 * Social Media Best Practices:
 * - og:title: Compelling title for social sharing (different from SEO title OK)
 * - og:description: Engaging description for social cards
 * - og:image: High-quality image (1200x630px recommended for Facebook)
 * - twitter:card: Twitter card type (summary, summary_large_image, etc.)
 * 
 * Detects:
 * - Missing Open Graph tags
 * - Missing Twitter Card tags
 * - Missing og:image or invalid image URLs
 * - Improper og:type
 */

import type { RawFinding } from '../types';
import type { CrawlResult } from '../types';

interface SocialMetaTags {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

function extractSocialMetaTags(html: string): SocialMetaTags {
  const tags: SocialMetaTags = {};
  
  // Extract Open Graph tags
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitleMatch) tags.ogTitle = ogTitleMatch[1];
  
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (ogDescMatch) tags.ogDescription = ogDescMatch[1];
  
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (ogImageMatch) tags.ogImage = ogImageMatch[1];
  
  const ogTypeMatch = html.match(/<meta\s+property=["']og:type["']\s+content=["']([^"']+)["']/i);
  if (ogTypeMatch) tags.ogType = ogTypeMatch[1];
  
  const ogUrlMatch = html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  if (ogUrlMatch) tags.ogUrl = ogUrlMatch[1];
  
  // Extract Twitter Card tags
  const twitterCardMatch = html.match(/<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i);
  if (twitterCardMatch) tags.twitterCard = twitterCardMatch[1];
  
  const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
  if (twitterTitleMatch) tags.twitterTitle = twitterTitleMatch[1];
  
  const twitterDescMatch = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
  if (twitterDescMatch) tags.twitterDescription = twitterDescMatch[1];
  
  const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
  if (twitterImageMatch) tags.twitterImage = twitterImageMatch[1];
  
  return tags;
}

export function runSocialMetaModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const tags = extractSocialMetaTags(crawl.html);
  
  // Check for missing Open Graph tags
  const missingOgTags: string[] = [];
  if (!tags.ogTitle) missingOgTags.push('og:title');
  if (!tags.ogDescription) missingOgTags.push('og:description');
  if (!tags.ogImage) missingOgTags.push('og:image');
  if (!tags.ogType) missingOgTags.push('og:type');
  
  if (missingOgTags.length > 0) {
    findings.push({
      moduleId: 'P4-02',
      severity: 'MEDIUM',
      category: 'SEO',
      title: `Missing Open Graph tags (${missingOgTags.length} tag${missingOgTags.length > 1 ? 's' : ''})`,
      location: 'HTML <head> element',
      evidence: `Missing: ${missingOgTags.join(', ')}`,
      explanation: 'Open Graph tags control how your page appears when shared on Facebook, LinkedIn, and other social platforms. Without these tags, social platforms will use generic fallbacks that may not represent your content well.',
      impact: `When users share this page on social media, it will appear with poor formatting or missing information. This reduces engagement and click-through rates from social platforms. ${missingOgTags.length} essential tag${missingOgTags.length > 1 ? 's are' : ' is'} missing.`,
      fixManual: [
        'Add <meta property="og:title" content="Your Page Title"> for the share title',
        'Add <meta property="og:description" content="..."> for the share description',
        'Add <meta property="og:image" content="https://..."> for the share image (1200x630px)',
        'Add <meta property="og:type" content="website"> (or "article" for blog posts)',
        'Add <meta property="og:url" content="https://..."> for canonical URL',
        'Test with Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/',
      ],
      fixAiPrompt: `My page is missing Open Graph tags: ${missingOgTags.join(', ')}.\n\nHelp me:\n1. Generate proper Open Graph meta tags\n2. Write compelling social media copy\n3. Recommend optimal image dimensions\n4. Ensure tags follow best practices`,
    });
  }
  
  // Check for missing Twitter Card tags
  if (!tags.twitterCard) {
    findings.push({
      moduleId: 'P4-02',
      severity: 'LOW',
      category: 'SEO',
      title: 'Missing Twitter Card tags',
      location: 'HTML <head> element',
      evidence: 'No twitter:card meta tag found',
      explanation: 'Twitter Card tags control how your page appears when shared on Twitter/X. Without a twitter:card tag, Twitter will use a basic text-only format instead of a rich media card.',
      impact: 'Shares on Twitter/X will appear as plain text links without images or rich previews, reducing engagement and click-through rates.',
      fixManual: [
        'Add <meta name="twitter:card" content="summary_large_image"> for large image cards',
        'Or use content="summary" for smaller square images',
        'Add <meta name="twitter:title" content="..."> (or Twitter will use og:title)',
        'Add <meta name="twitter:description" content="..."> (or Twitter will use og:description)',
        'Add <meta name="twitter:image" content="https://..."> (or Twitter will use og:image)',
        'Test with Twitter Card Validator: https://cards-dev.twitter.com/validator',
      ],
      fixAiPrompt: 'My page is missing Twitter Card tags.\n\nHelp me add proper Twitter Card meta tags for rich social sharing on Twitter/X.',
    });
  }
  
  // Check if og:image exists but might be problematic
  if (tags.ogImage) {
    // Check if it's a relative URL (should be absolute)
    if (!tags.ogImage.startsWith('http://') && !tags.ogImage.startsWith('https://')) {
      findings.push({
        moduleId: 'P4-02',
        severity: 'MEDIUM',
        category: 'SEO',
        title: 'Open Graph image uses relative URL',
        location: 'og:image meta tag',
        evidence: `og:image="${tags.ogImage}" (relative URL)`,
        explanation: 'Open Graph image URLs must be absolute (starting with https://). Social platforms cannot resolve relative URLs and will fail to display the image.',
        impact: 'Social media shares will appear without an image, significantly reducing engagement and click-through rates.',
        fixManual: [
          'Convert relative URL to absolute URL',
          'Example: /images/og.jpg → https://yoursite.com/images/og.jpg',
          'Ensure the image is publicly accessible (no authentication required)',
          'Recommended size: 1200x630px for Facebook, Twitter',
        ],
        fixAiPrompt: `My og:image uses a relative URL: "${tags.ogImage}".\n\nHelp me convert this to an absolute URL.`,
      });
    }
  }
  
  return findings;
}
