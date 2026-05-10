import type { CrawlResult, RawFinding } from '../types';

interface MixedItem { tag: string; attr: string; url: string }

function extractMixedContent(html: string): MixedItem[] {
  const items: MixedItem[] = [];
  const patterns: Array<{ tag: string; attr: string; re: RegExp }> = [
    { tag: 'script', attr: 'src', re: /<script[^>]+src=["'](http:\/\/[^"']+)["']/gi },
    { tag: 'link', attr: 'href', re: /<link[^>]+href=["'](http:\/\/[^"']+)["']/gi },
    { tag: 'img', attr: 'src', re: /<img[^>]+src=["'](http:\/\/[^"']+)["']/gi },
    { tag: 'iframe', attr: 'src', re: /<iframe[^>]+src=["'](http:\/\/[^"']+)["']/gi },
    { tag: 'video', attr: 'src', re: /<(?:video|audio)[^>]+src=["'](http:\/\/[^"']+)["']/gi },
    { tag: 'form', attr: 'action', re: /<form[^>]+action=["'](http:\/\/[^"']+)["']/gi },
  ];

  for (const { tag, attr, re } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      items.push({ tag, attr, url: match[1] });
    }
  }
  return items;
}

export function runMixedContentModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const parsed = new URL(crawl.finalUrl);

  // Only flag if the page itself is HTTPS
  if (parsed.protocol !== 'https:') return findings;

  const mixed = extractMixedContent(crawl.html);
  if (mixed.length === 0) return findings;

  const scriptsMixed = mixed.filter((i) => i.tag === 'script');
  const formsMixed = mixed.filter((i) => i.tag === 'form');
  const otherMixed = mixed.filter((i) => i.tag !== 'script' && i.tag !== 'form');

  if (scriptsMixed.length > 0) {
    findings.push({
      moduleId: 'P1-08',
      severity: 'HIGH',
      category: 'Mixed Content',
      title: `${scriptsMixed.length} script${scriptsMixed.length > 1 ? 's' : ''} loaded over HTTP on HTTPS page`,
      location: scriptsMixed.map((i) => i.url).join(', ').slice(0, 200),
      evidence: scriptsMixed.map((i) => `<script src="${i.url}">`).join('\n'),
      explanation: 'Scripts loaded over HTTP on an HTTPS page can be intercepted and replaced with malicious code by a network attacker. Modern browsers block this (active mixed content), breaking your page.',
      impact: 'Page may be broken in modern browsers. On older browsers or proxies, the unencrypted script could be replaced with malicious code.',
      fixManual: [
        'Update all script src attributes to use https://.',
        'If the resource is yours, ensure HTTPS is enabled on the CDN or server.',
        'If third-party, contact the provider or find an HTTPS alternative.',
      ],
      fixAiPrompt: `My HTTPS page loads scripts over HTTP: ${scriptsMixed.map((i) => i.url).join(', ')}. Update these to HTTPS in my source code.`,
    });
  }

  if (formsMixed.length > 0) {
    findings.push({
      moduleId: 'P1-08',
      severity: 'HIGH',
      category: 'Mixed Content',
      title: `Form submits over HTTP from HTTPS page`,
      location: formsMixed.map((i) => i.url).join(', ').slice(0, 200),
      evidence: formsMixed.map((i) => `<form action="${i.url}">`).join('\n'),
      explanation: 'A form on your HTTPS page posts data to an HTTP URL. Form data (passwords, personal info) is transmitted unencrypted, defeating the purpose of HTTPS.',
      impact: 'All data submitted via this form (including passwords or payment info) is transmitted in plaintext.',
      fixManual: [
        'Change form action URLs to https://.',
        'If the endpoint is yours, enable HTTPS.',
        'Never submit sensitive data to an HTTP endpoint.',
      ],
      fixAiPrompt: `My HTTPS page has forms that submit to HTTP URLs: ${formsMixed.map((i) => i.url).join(', ')}. Update form actions to HTTPS.`,
    });
  }

  if (otherMixed.length > 0) {
    findings.push({
      moduleId: 'P1-08',
      severity: 'MEDIUM',
      category: 'Mixed Content',
      title: `${otherMixed.length} passive resource${otherMixed.length > 1 ? 's' : ''} loaded over HTTP`,
      location: otherMixed.map((i) => i.url).join(', ').slice(0, 200),
      evidence: otherMixed.map((i) => `<${i.tag} ${i.attr}="${i.url}">`).join('\n'),
      explanation: 'Images, iframes, or media are loaded over HTTP on your HTTPS page. While browsers may allow this (passive mixed content), it degrades the security of your HTTPS connection.',
      impact: 'Passive mixed content may be intercepted or replaced. It also causes browser security warnings.',
      fixManual: [
        'Update all resource URLs to https://.',
        "Use protocol-relative URLs (//) if the resource supports both HTTP and HTTPS.",
      ],
      fixAiPrompt: `My HTTPS page loads passive resources over HTTP: ${otherMixed.map((i) => i.url).join(', ')}. Update these to HTTPS.`,
    });
  }

  return findings;
}
