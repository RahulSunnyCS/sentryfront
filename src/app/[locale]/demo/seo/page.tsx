/**
 * SEO Demo Page
 * Phase 7.5: SEO Scanning
 * 
 * Demonstrates SEO scanning UI components with realistic mock data
 */

import { SEOSection } from '@/components/seo-section';
import type { Finding } from '@/types';

// Mock SEO findings with realistic examples
const mockSEOFindings: Finding[] = [
  // P4-01: Meta Tags & Titles
  {
    id: '1',
    module: 'P4-01',
    category: 'SEO',
    severity: 'HIGH',
    title: 'Missing or improper document title',
    location: 'HTML <head> element',
    evidence: 'Document does not have a <title> element',
    explanation: 'The title element is critical for SEO. It appears in search results as the clickable headline and in browser tabs. Google typically displays the first 50-60 characters of a title tag.',
    impact: 'Search engines may not properly index this page. Users won\'t see a descriptive title in search results, reducing click-through rate (CTR).',
    fixManual: [
      'Add a unique <title> element to the <head> section',
      'Keep it 50-60 characters (Google truncates longer titles)',
      'Include primary keyword near the beginning',
    ],
    fixAiPrompt: 'Help me write an SEO-optimized title (50-60 characters) that includes relevant keywords.',
  },
  {
    id: '2',
    module: 'P4-01',
    category: 'SEO',
    severity: 'MEDIUM',
    title: 'Missing or improper meta description',
    location: 'HTML <head> element',
    evidence: 'Document does not have a meta description',
    explanation: 'Meta descriptions provide a summary of the page content in search results. While not a direct ranking factor, they significantly impact click-through rate (CTR).',
    impact: 'Google will auto-generate a description from page content, which may not be optimal. Lower CTR from search results.',
    fixManual: [
      'Add <meta name="description" content="..."> to <head>',
      'Keep it 150-160 characters',
      'Write compelling copy that encourages clicks',
    ],
    fixAiPrompt: 'Help me write a compelling meta description (150-160 characters) that encourages users to click.',
  },

  // P4-02: Social Media
  {
    id: '3',
    module: 'P4-02',
    category: 'SEO',
    severity: 'MEDIUM',
    title: 'Missing Open Graph tags',
    location: 'HTML <head> meta tags',
    evidence: 'No og:title, og:description, or og:image tags found',
    explanation: 'Open Graph tags control how your page appears when shared on Facebook, LinkedIn, and other social platforms. Without them, social platforms will use fallback content that may not be optimal.',
    impact: 'When shared on social media, your page will have generic or missing previews, resulting in lower engagement and click-through rates.',
    fixManual: [
      'Add og:title - Should match or be similar to <title>',
      'Add og:description - Compelling description for social',
      'Add og:image - High quality image (1200x630px recommended)',
      'Add og:url - Canonical URL of the page',
    ],
    fixAiPrompt: 'Help me create Open Graph meta tags for social media sharing with compelling copy.',
  },
  {
    id: '4',
    module: 'P4-02',
    category: 'SEO',
    severity: 'LOW',
    title: 'Missing Twitter Card tags',
    location: 'HTML <head> meta tags',
    evidence: 'No twitter:card, twitter:title, or twitter:description tags found',
    explanation: 'Twitter Cards enhance how your content appears when shared on Twitter/X. Without them, Twitter uses basic link previews.',
    impact: 'Tweets linking to your page will have less engaging previews, potentially reducing retweets and clicks from Twitter traffic.',
    fixManual: [
      'Add twitter:card (use "summary_large_image" for best results)',
      'Add twitter:title',
      'Add twitter:description',
      'Add twitter:image',
    ],
    fixAiPrompt: 'Help me create Twitter Card meta tags to optimize sharing on Twitter/X.',
  },

  // P4-03: Structured Data
  {
    id: '5',
    module: 'P4-03',
    category: 'SEO',
    severity: 'MEDIUM',
    title: 'Missing structured data (Schema.org markup)',
    location: 'HTML <head> or <body>',
    evidence: 'No JSON-LD structured data found',
    explanation: 'Structured data (Schema.org markup) helps search engines understand your content and can enable rich snippets in search results.',
    impact: 'Page will not appear with rich snippets. Missing opportunities for enhanced visibility with star ratings, breadcrumbs, and other rich features.',
    fixManual: [
      'Add JSON-LD structured data to your <head> or <body>',
      'Common types: Organization, WebSite, Article, Product, BreadcrumbList',
      'Use Google\'s Rich Results Test to validate',
    ],
    fixAiPrompt: 'Help me determine appropriate Schema.org types and generate JSON-LD markup for this page.',
  },

  // P4-04: Crawlability
  {
    id: '6',
    module: 'P4-04',
    category: 'SEO',
    severity: 'MEDIUM',
    title: 'JavaScript-only links detected (3 links)',
    location: 'Navigation links',
    evidence: '3 links use JavaScript instead of proper <a href> tags',
    explanation: 'Links that only work with JavaScript cannot be followed by search engine crawlers. This prevents search engines from discovering linked pages.',
    impact: 'Search engines cannot discover or index pages only accessible via JavaScript links. Internal link equity is not passed.',
    fixManual: [
      'Convert JavaScript links to proper <a href="..."> tags',
      'Add href attribute even if using onClick handlers',
      'Use progressive enhancement (href works without JS)',
    ],
    fixAiPrompt: 'Help me convert JavaScript-only links to proper anchor tags while maintaining functionality.',
  },

  // P4-05: Mobile SEO
  {
    id: '7',
    module: 'P4-05',
    category: 'SEO',
    severity: 'MEDIUM',
    title: 'Tap targets too small for mobile (5 elements)',
    location: 'Interactive elements',
    evidence: '5 clickable elements are smaller than 48x48px',
    explanation: 'Tap targets (buttons, links) should be at least 48x48 pixels. Small targets are difficult to tap accurately on touch devices.',
    impact: 'Poor mobile usability score. Elements are difficult to tap on mobile. May affect mobile rankings.',
    fixManual: [
      'Ensure buttons/links are at least 48x48px',
      'Add padding to increase touch area',
      'Provide spacing between adjacent tap targets',
    ],
    fixAiPrompt: 'Help me increase tap target sizes to 48x48px minimum while maintaining design.',
  },
];

export default function SEODemoPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">SEO Scanning Demo</h1>
        <p className="text-gray-600">
          Demonstration of SEO analysis features including meta tags, social media optimization,
          structured data, crawlability, and mobile SEO.
        </p>
      </div>

      <SEOSection
        seoGrade="C"
        seoScore={72}
        seoMetrics={{ issues: mockSEOFindings }}
      />

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About This Demo</h3>
        <p className="text-sm text-blue-800">
          This demo page showcases the SEO scanning interface with realistic mock data.
          In production, SEO scans run automatically when <code className="bg-blue-100 px-1 rounded">SEO_SCANNING_ENABLED=true</code> is set.
          The scanner checks 5 categories: Meta Tags, Social Media, Structured Data, Crawlability, and Mobile SEO.
        </p>
      </div>
    </div>
  );
}
