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

  // ── Phase 3.11: SEO + AI-discoverability depth pass ───────────────────────
  // P4-01: canonical chain resolution (cross-source: cheerio + direct fetch +
  // Lighthouse all agree → HIGH / high confidence)
  {
    id: '8',
    module: 'P4-01',
    category: 'SEO',
    severity: 'HIGH',
    title: 'Canonical URL redirect loop',
    location: 'HTML <head> element',
    evidence: '<link rel="canonical" href="https://example.com/p?ref=1"> → redirect loop (after 1 hop)',
    explanation:
      'A canonical URL must resolve to a single, stable 2xx page. Loops or non-2xx canonicals leave search engines unable to pick the authoritative URL, splitting or dropping ranking signals.',
    impact: 'Search engines may ignore the canonical and index duplicates, or drop the page entirely.',
    fixManual: [
      'Point rel=canonical at the final, self-resolving 2xx URL.',
      'Remove redirect chains on the canonical target.',
    ],
    fixAiPrompt: 'My canonical URL is in a redirect loop. Help me set rel=canonical to the correct stable 200 URL.',
    confidence: 'high',
  },
  // P4-01: responsive viewport (single-source cheerio → downgraded, medium)
  {
    id: '9',
    module: 'P4-01',
    category: 'SEO',
    severity: 'LOW',
    title: 'Missing responsive viewport meta tag',
    location: 'HTML <head> element',
    evidence: 'No <meta name="viewport"> found in the document head',
    explanation:
      'Without a viewport meta tag, mobile browsers render at desktop width and zoom out. Google uses mobile-first indexing, so a non-responsive page is penalised in mobile search.',
    impact: 'Lower mobile search ranking and a poor mobile UX.',
    fixManual: ['Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.'],
    fixAiPrompt: 'Add the correct responsive viewport meta tag and confirm my layout is mobile-responsive.',
    confidence: 'medium',
  },
  // P4-02: og:image reachability
  {
    id: '10',
    module: 'P4-02',
    category: 'SEO',
    severity: 'LOW',
    title: 'Open Graph image is unreachable',
    location: 'og:image meta tag',
    evidence: 'og:image="https://cdn.example.com/card.png" → HTTP 404',
    explanation:
      'The og:image URL is absolute but does not return a fetchable image. Social and chat link-preview bots will drop the image and render a bare text card.',
    impact: 'Shares appear without a preview image, sharply reducing click-through.',
    fixManual: ['Ensure the og:image URL returns HTTP 200 with an image/* content-type.'],
    fixAiPrompt: 'My og:image is unreachable. Help me fix the URL/hosting so it returns a public 200 image.',
    confidence: 'medium',
  },
  // P4-03: Schema.org required-field validation
  {
    id: '11',
    module: 'P4-03',
    category: 'SEO',
    severity: 'LOW',
    title: 'Schema.org Article is missing required fields: author, datePublished',
    location: 'JSON-LD structured data',
    evidence: 'Article block is missing: author, datePublished',
    explanation:
      "Google's rich-result requirements for Article expect headline, author, datePublished. Missing required properties make the block ineligible for the rich result.",
    impact: 'This Article markup will not produce a rich result in Google Search.',
    fixManual: ['Add the missing Article properties: author, datePublished.', 'Validate with Google Rich Results Test.'],
    fixAiPrompt: 'My JSON-LD Article is missing required properties. Generate corrected JSON-LD consistent with my page.',
    confidence: 'medium',
  },
  // P4-04: hreflang surfacing
  {
    id: '12',
    module: 'P4-04',
    category: 'SEO',
    severity: 'LOW',
    title: 'hreflang annotations have issues',
    location: 'HTML <head> / HTTP headers',
    evidence: 'Invalid hreflang value: "en_US"',
    explanation:
      'hreflang tells Google which language/region variant to serve. Invalid BCP-47 codes or missing return links cause Google to ignore the annotations.',
    impact: 'Wrong-language pages shown in regional search results; duplicate-content dilution across locales.',
    fixManual: ['Use valid BCP-47 codes (en, en-GB, es-419, x-default).', 'Every variant must reference every other variant.'],
    fixAiPrompt: 'My hreflang annotations are invalid. Help me generate a correct, fully reciprocal hreflang set.',
    confidence: 'medium',
  },
  // P4-04: sitemap.xml structural validity
  {
    id: '13',
    module: 'P4-04',
    category: 'SEO',
    severity: 'LOW',
    title: 'sitemap.xml is structurally invalid',
    location: '/sitemap.xml',
    evidence: 'sitemap.xml root element <pages> is not <urlset> or <sitemapindex>',
    explanation:
      'A sitemap must be well-formed XML with a <urlset> or <sitemapindex> root and at most 50,000 URLs / 50 MB per the sitemaps.org protocol.',
    impact: 'Search engines may ignore the entire sitemap, slowing discovery of new/updated pages.',
    fixManual: ['Ensure the root element is <urlset> or <sitemapindex>.', 'Split into a sitemap index if over 50,000 URLs.'],
    fixAiPrompt: 'My sitemap.xml is invalid. Help me produce a spec-compliant sitemap for my URLs.',
    confidence: 'medium',
  },
  // P4-06: AI discoverability — llms.txt
  {
    id: '14',
    module: 'P4-06',
    category: 'AI Discoverability',
    severity: 'LOW',
    title: 'No /llms.txt file found',
    location: '/llms.txt',
    evidence: 'GET https://example.com/llms.txt did not return a usable file',
    explanation:
      'llms.txt (llmstxt.org) gives AI assistants a curated, plain-Markdown map of your most important content. Without it, AI search tools guess from your full HTML.',
    impact: 'Reduced control over how AI assistants summarise and cite your site. An opportunity gap, not a defect.',
    fixManual: [
      'Add an /llms.txt file at the site root.',
      'First line must be an H1 with the site/product name: "# Acme Docs".',
    ],
    fixAiPrompt: 'Generate an llms.txt file (per the llmstxt.org spec) listing my most important pages.',
    confidence: 'medium',
  },
  // P4-06: AI discoverability — AI-crawler robots policy
  {
    id: '15',
    module: 'P4-06',
    category: 'AI Discoverability',
    severity: 'INFO',
    title: 'AI-crawler robots.txt policy detected (2 blocked, 1 allowed)',
    location: '/robots.txt',
    evidence: 'explicitly blocked: GPTBot, CCBot; explicitly allowed: PerplexityBot',
    explanation:
      'Your robots.txt sets explicit rules for AI crawlers. Blocking training crawlers keeps content out of AI training; allowing answer-engine agents keeps you visible in AI search. Surfaced for awareness, not flagged as a defect.',
    impact: 'Blocked AI crawlers will not cite or summarise your content.',
    fixManual: [
      'Decide per-agent: answer engines vs training crawlers.',
      'Set explicit "User-agent: <agent>" groups with the intended Allow/Disallow.',
    ],
    fixAiPrompt: 'Help me set an intentional per-agent AI-crawler robots.txt policy that matches my goals.',
    confidence: 'medium',
  },
  // P4-06: AI discoverability — rendered vs initial content diff
  {
    id: '16',
    module: 'P4-06',
    category: 'AI Discoverability',
    severity: 'LOW',
    title: 'Initial HTML exposes only ~12% of rendered content',
    location: 'https://example.com/app',
    evidence: 'Initial (no-JS) visible text 180 chars vs rendered 1480 chars (12%)',
    explanation:
      'AI crawlers and no-JS fetchers read the initial server HTML, not the post-JavaScript DOM. When the initial HTML is a small fraction of the rendered text, those agents see almost none of your content.',
    impact: 'AI assistants and many crawlers will summarise this page from near-empty HTML, badly under-representing it.',
    fixManual: [
      'Server-render or pre-render the primary content (SSR/SSG/ISR).',
      'Ensure headings, body copy, and key links exist in the initial HTML response.',
    ],
    fixAiPrompt: 'My page renders content client-side so AI crawlers see near-empty HTML. Help me move primary content into SSR.',
    confidence: 'medium',
  },
];

export default function SEODemoPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">SEO Scanning Demo</h1>
        <p className="text-gray-600">
          Demonstration of SEO analysis features including meta tags, social media optimization,
          structured data, crawlability, mobile SEO, and AI search optimisation
          (llms.txt, AI-crawler policy, rendered-vs-initial content).
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
          The scanner checks Meta Tags, Social Media, Structured Data, Crawlability, and Mobile SEO,
          plus a cross-source-corroborated depth pass (toggle <code className="bg-blue-100 px-1 rounded">seoDepthPass</code>)
          that adds canonical-chain, hreflang, sitemap validity, og:image reachability, Schema.org
          required-field, and AI-discoverability checks. <code className="bg-blue-100 px-1 rounded">confidence: high</code>{' '}
          requires ≥2 sources agreeing.
        </p>
      </div>
    </div>
  );
}
