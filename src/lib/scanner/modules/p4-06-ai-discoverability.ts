/**
 * P4-06: AI Discoverability Module
 * Phase 3.11: SEO + AI-discoverability bundle
 *
 * Captures the AI-search surface that classic SEO audits miss:
 *  - /llms.txt presence + basic shape validation (llmstxt.org spec)
 *  - AI-crawler robots.txt policy for GPTBot / ClaudeBot / PerplexityBot /
 *    Google-Extended / CCBot / anthropic-ai / cohere-ai (robots-parser)
 *  - rendered-vs-initial HTML content diff — AI crawlers and no-JS fetchers
 *    see the initial HTML; warn when that is <30% of the rendered text
 *
 * Findings carry a `confidence` set via seo-corroborate. None of these checks
 * touch an LLM or any paid/keyed service, so the module always runs; the only
 * external call (W3C Nu, used elsewhere) is fail-soft.
 */

import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import type { CrawlResult, RawFinding } from '../types';
import { corroborate, type SourceObservation } from './seo-corroborate';
import { fetchTextSafe } from '../tools/seo-fetch';

const AI_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'anthropic-ai',
  'cohere-ai',
] as const;

const CONTENT_DIFF_FLOOR = 0.3;

function visibleTextLength(html: string): number {
  if (!html) return 0;
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().length;
}

type AgentPolicy = 'allow' | 'block' | 'unspecified';

function hasExplicitGroup(robotsTxt: string, agent: string): boolean {
  const needle = agent.toLowerCase();
  for (const line of robotsTxt.split(/\r?\n/)) {
    const m = line.match(/^\s*user-agent:\s*([^#]+?)\s*$/i);
    if (m && m[1].toLowerCase() === needle) return true;
  }
  return false;
}

function analyseAiCrawlerPolicy(
  robotsTxt: string,
  origin: string,
): Record<string, AgentPolicy> {
  const out: Record<string, AgentPolicy> = {};
  let robots: ReturnType<typeof robotsParser> | null = null;
  try {
    robots = robotsParser(`${origin}/robots.txt`, robotsTxt);
  } catch {
    robots = null;
  }
  for (const agent of AI_CRAWLERS) {
    if (!hasExplicitGroup(robotsTxt, agent)) {
      out[agent] = 'unspecified';
      continue;
    }
    const allowed = robots ? robots.isAllowed(`${origin}/`, agent) : undefined;
    out[agent] = allowed === false ? 'block' : 'allow';
  }
  return out;
}

function validateLlmsTxtShape(body: string): { valid: boolean; reason: string } {
  const lines = body.split(/\r?\n/);
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty) {
    return { valid: false, reason: 'file is empty' };
  }
  if (!/^#\s+\S/.test(firstNonEmpty.trim())) {
    return {
      valid: false,
      reason: `first line is not an H1 title ("# Name") — got: ${firstNonEmpty.trim().slice(0, 60)}`,
    };
  }
  return { valid: true, reason: '' };
}

export async function runAiDiscoverabilityModule(
  crawl: CrawlResult,
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  let origin: string;
  try {
    origin = new URL(crawl.finalUrl).origin;
  } catch {
    return findings;
  }

  const [llmsTxt, robotsTxt] = await Promise.all([
    fetchTextSafe(`${origin}/llms.txt`),
    fetchTextSafe(`${origin}/robots.txt`),
  ]);

  // ── /llms.txt presence + shape ────────────────────────────────────────────
  if (llmsTxt === null) {
    const { severity, confidence } = corroborate(
      [{ source: 'direct-fetch', failed: true }],
      'LOW',
    );
    findings.push({
      moduleId: 'P4-06',
      severity,
      confidence,
      category: 'AI Discoverability',
      title: 'No /llms.txt file found',
      location: '/llms.txt',
      evidence: `GET ${origin}/llms.txt did not return a usable file`,
      explanation:
        'llms.txt (llmstxt.org) is an emerging convention that gives AI assistants a curated, plain-Markdown map of your most important content. Without it, AI search tools fall back to guessing from your full HTML, which is noisier and may surface the wrong pages.',
      impact:
        'Reduced control over how AI assistants summarise and cite your site. This is an opportunity gap, not a defect — many sites do not yet ship llms.txt.',
      fixManual: [
        'Add an /llms.txt file at the site root.',
        'First line must be an H1 with the site/product name: "# Acme Docs".',
        'Optionally add a blockquote summary, then "##" sections listing key pages as "[Title](https://…): short note".',
        'Keep it curated — link the canonical, high-value pages only.',
      ],
      fixAiPrompt:
        'Generate an llms.txt file (per the llmstxt.org spec) for my site. It should start with an H1 title, include a one-paragraph summary, and list my most important pages grouped under "##" sections as Markdown links with short descriptions.',
    });
  } else {
    const shape = validateLlmsTxtShape(llmsTxt);
    if (!shape.valid) {
      const { severity, confidence } = corroborate(
        [{ source: 'direct-fetch', failed: true }],
        'LOW',
      );
      findings.push({
        moduleId: 'P4-06',
        severity,
        confidence,
        category: 'AI Discoverability',
        title: 'llms.txt is present but malformed',
        location: '/llms.txt',
        evidence: shape.reason,
        explanation:
          'An llms.txt file was found but does not match the llmstxt.org shape. The spec requires the file to open with an H1 title line ("# Name"); tools that consume llms.txt may ignore a file that does not parse.',
        impact:
          'AI assistants relying on the llms.txt convention may skip your file entirely, so the curation effort is wasted.',
        fixManual: [
          'Make the first non-empty line an H1: "# Your Site Name".',
          'Follow with an optional ">" blockquote summary.',
          'Group links under "##" section headers as "[Title](https://…): note".',
        ],
        fixAiPrompt:
          'My llms.txt file is malformed. Rewrite it to follow the llmstxt.org spec: an H1 title first, an optional blockquote summary, then "##" sections of Markdown links with short descriptions. Preserve the existing links.',
      });
    } else {
      findings.push({
        moduleId: 'P4-06',
        severity: 'INFO',
        confidence: 'medium',
        category: 'AI Discoverability',
        title: 'llms.txt present and well-formed',
        location: '/llms.txt',
        evidence: llmsTxt.split(/\r?\n/).find((l) => l.trim())?.slice(0, 80) ?? '',
        explanation:
          'A valid llms.txt was found. AI assistants that support the llmstxt.org convention can use it to find and cite your key content accurately.',
        impact:
          'Positive signal — improved control over AI-assistant summarisation and citation.',
        fixManual: [
          'Keep llms.txt in sync as key pages change.',
          'Consider an llms-full.txt with expanded content if you publish docs.',
        ],
        fixAiPrompt:
          'Review my llms.txt for completeness against the llmstxt.org spec and suggest any high-value pages I should add.',
      });
    }
  }

  // ── AI-crawler robots.txt policy ──────────────────────────────────────────
  if (robotsTxt) {
    const policy = analyseAiCrawlerPolicy(robotsTxt, origin);
    const blocked = Object.entries(policy)
      .filter(([, v]) => v === 'block')
      .map(([k]) => k);
    const allowed = Object.entries(policy)
      .filter(([, v]) => v === 'allow')
      .map(([k]) => k);

    if (blocked.length > 0 || allowed.length > 0) {
      const summary = [
        blocked.length ? `explicitly blocked: ${blocked.join(', ')}` : '',
        allowed.length ? `explicitly allowed: ${allowed.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      findings.push({
        moduleId: 'P4-06',
        severity: 'INFO',
        confidence: 'medium',
        category: 'AI Discoverability',
        title: `AI-crawler robots.txt policy detected (${blocked.length} blocked, ${allowed.length} allowed)`,
        location: '/robots.txt',
        evidence: summary,
        explanation:
          'Your robots.txt sets explicit rules for AI crawlers. Blocking GPTBot/ClaudeBot/Google-Extended/etc. keeps your content out of AI training and (for some) out of AI answer engines. This may be intentional — surfaced for awareness, not flagged as a defect.',
        impact:
          'Blocked AI crawlers will not cite or summarise your content. If you want AI-search visibility, allow the answer-engine agents; if you want to opt out of AI training, blocking is correct.',
        fixManual: [
          'Decide per-agent: answer engines (PerplexityBot) vs training crawlers (GPTBot, CCBot, Google-Extended).',
          'Set explicit "User-agent: <agent>" groups in robots.txt with the intended Allow/Disallow.',
          'Remember robots.txt is advisory — it is not an access control.',
        ],
        fixAiPrompt: `My robots.txt AI-crawler policy is: ${summary}. Help me set an intentional per-agent policy that matches my goal of [AI-search visibility / opting out of AI training].`,
      });
    }
  }

  // ── Rendered-vs-initial content diff ──────────────────────────────────────
  const initialLen = visibleTextLength(crawl.html);
  const rendered = crawl.renderedHtml;
  const skipDiff =
    crawl.renderMode === 'fetch-only' || !rendered || rendered.trim().length === 0;

  if (!skipDiff) {
    const renderedLen = visibleTextLength(rendered as string);
    if (renderedLen > 0) {
      const ratio = initialLen / renderedLen;
      if (ratio < CONTENT_DIFF_FLOOR) {
        const observations: SourceObservation[] = [{ source: 'cheerio', failed: true }];
        const { severity, confidence } = corroborate(observations, 'MEDIUM');
        const pct = Math.round(ratio * 100);
        findings.push({
          moduleId: 'P4-06',
          severity,
          confidence,
          category: 'AI Discoverability',
          title: `Initial HTML exposes only ~${pct}% of rendered content`,
          location: crawl.finalUrl,
          evidence: `Initial (no-JS) visible text ${initialLen} chars vs rendered ${renderedLen} chars (${pct}%)`,
          explanation:
            'AI crawlers and no-JS fetchers read the initial server HTML, not the post-JavaScript DOM. When the initial HTML contains a small fraction of the rendered text, those agents see almost none of your content.',
          impact:
            'AI assistants and many search/preview crawlers will summarise and cite this page from near-empty HTML, badly under-representing it.',
          fixManual: [
            'Server-render or pre-render the primary content (SSR/SSG/ISR).',
            'Ensure headings, body copy, and key links exist in the initial HTML response.',
            'Avoid gating main content behind client-only data fetches.',
          ],
          fixAiPrompt:
            'My page renders most of its content client-side, so the initial HTML AI crawlers see is nearly empty. Help me move the primary content into the server-rendered HTML using my framework (Next.js/Remix/etc.) without breaking client interactivity.',
        });
      }
    }
  }

  return findings;
}
