import type { CrawlResult, RawFinding } from '../types';
import { runGitleaks } from '../tools/gitleaks';

interface SecretPattern {
  name: string;
  category: string;
  pattern: RegExp;
  severity: RawFinding['severity'];
  redact: (match: string) => string;
}

const PATTERNS: SecretPattern[] = [
  {
    name: 'Stripe live secret key',
    category: 'Client-Side Secret Exposure',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    severity: 'CRITICAL',
    redact: (m) => `${m.slice(0, 12)}****${m.slice(-4)}`,
  },
  {
    name: 'Stripe test secret key',
    category: 'Client-Side Secret Exposure',
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
    severity: 'HIGH',
    redact: (m) => `${m.slice(0, 12)}****${m.slice(-4)}`,
  },
  {
    name: 'OpenAI API key',
    category: 'Client-Side Secret Exposure',
    pattern: /sk-[a-zA-Z0-9\-_]{40,}/g,
    severity: 'CRITICAL',
    redact: (m) => `${m.slice(0, 8)}****${m.slice(-4)}`,
  },
  {
    name: 'AWS access key ID',
    category: 'Client-Side Secret Exposure',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'CRITICAL',
    redact: (m) => `${m.slice(0, 8)}****${m.slice(-4)}`,
  },
  {
    name: 'GitHub personal access token',
    category: 'Client-Side Secret Exposure',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    severity: 'CRITICAL',
    redact: (m) => `${m.slice(0, 8)}****${m.slice(-4)}`,
  },
  {
    name: 'Generic API key assignment',
    category: 'Client-Side Secret Exposure',
    pattern: /(?:api[_-]?key|apikey|api_secret|auth[_-]?token)\s*[:=]\s*["']([a-zA-Z0-9\-_]{32,})["']/gi,
    severity: 'HIGH',
    redact: (m) => m.replace(/["'][a-zA-Z0-9\-_]{8}([a-zA-Z0-9\-_]+)[a-zA-Z0-9\-_]{4}["']/, (s) => `"${s.slice(1, 5)}****${s.slice(-5, -1)}"`),
  },
  {
    name: 'Private key block',
    category: 'Client-Side Secret Exposure',
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    severity: 'CRITICAL',
    redact: () => '-----BEGIN PRIVATE KEY----- [redacted]',
  },
];

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    freq[c] = (freq[c] ?? 0) + 1;
  }
  let entropy = 0;
  for (const key of Object.keys(freq)) {
    const p = freq[key] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Detect high-entropy strings that look like secrets (not base64-encoded assets).
function findHighEntropyStrings(content: string): Array<{ match: string; context: string }> {
  // Look for quoted strings 32–80 chars, not URLs, not hex colors
  const re = /["']([a-zA-Z0-9+/=\-_]{32,80})["']/g;
  const results: Array<{ match: string; context: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const candidate = m[1];
    if (shannonEntropy(candidate) > 4.5 && !/^[0-9a-f]+$/.test(candidate)) {
      const start = Math.max(0, m.index - 40);
      const context = content.slice(start, m.index + m[0].length + 40);
      results.push({ match: candidate, context });
      if (results.length >= 3) break; // cap to avoid noise
    }
  }
  return results;
}

async function fetchBundleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return '';
    return res.text();
  } catch {
    return '';
  }
}

export async function runSecretsModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];

  // Scan inline scripts + each JS bundle
  const sources: Array<{ label: string; content: string }> = [
    { label: 'inline scripts', content: crawl.inlineScriptContent },
  ];

  const bundleContents = await Promise.all(
    crawl.jsBundleUrls.slice(0, 20).map(async (url) => ({
      label: url.replace(crawl.finalUrl.replace(/\/$/, ''), '') || url,
      content: await fetchBundleContent(url),
    })),
  );
  sources.push(...bundleContents);

  // Run gitleaks (700+ rules) — results replace regex findings for matched rules
  const gitleaksFindings = await runGitleaks(sources);
  if (gitleaksFindings.length > 0) {
    findings.push(...gitleaksFindings);
    // Still run regex+entropy below, but skip sources already covered by gitleaks
    const coveredLocations = new Set(gitleaksFindings.map((f) => f.location));
    const uncovered = sources.filter((s) => !coveredLocations.has(s.label));
    sources.splice(0, sources.length, ...uncovered);
  }

  for (const { label, content } of sources) {
    if (!content) continue;

    for (const pattern of PATTERNS) {
      const matches: RegExpExecArray[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      while ((m = re.exec(content)) !== null) { matches.push(m); }
      for (const match of matches) {
        const raw = match[0];
        const redacted = pattern.redact(raw);
        findings.push({
          moduleId: 'P1-01',
          severity: pattern.severity,
          category: pattern.category,
          title: `${pattern.name} exposed in JavaScript`,
          location: label,
          evidence: redacted,
          explanation: `A ${pattern.name} was found in client-side JavaScript. Anyone with browser devtools can read it.`,
          impact: 'Attackers can authenticate as your application and access external APIs or services with full permissions.',
          fixManual: [
            'Remove the secret from client-side code immediately.',
            'Move API calls that require this key to a server-side route.',
            'Rotate the compromised credential now — assume it has been read.',
            'Store secrets only in server-side environment variables (e.g., Vercel → Settings → Environment Variables).',
          ],
          fixAiPrompt: `I have a ${pattern.name} exposed in my client-side JavaScript bundle. Move the API call that uses it to a Next.js server route (/api/...) so the key is never sent to the browser.`,
        });
        break; // one finding per pattern per source file
      }
    }

    // High-entropy check (skip if we already found known patterns)
    if (findings.filter((f) => f.location === label).length === 0) {
      const highEntropy = findHighEntropyStrings(content);
      if (highEntropy.length > 0) {
        findings.push({
          moduleId: 'P1-01',
          severity: 'MEDIUM',
          category: 'Client-Side Secret Exposure',
          title: 'High-entropy string detected — possible secret',
          location: label,
          evidence: `"${highEntropy[0].match.slice(0, 8)}****${highEntropy[0].match.slice(-4)}"`,
          explanation: 'A string with unusually high randomness (Shannon entropy > 4.5 bits/char) was found in client-side code. This pattern is common in API keys, tokens, and credentials.',
          impact: 'If this is a secret or credential, it is exposed to any visitor.',
          fixManual: [
            'Review the flagged string and identify what it is.',
            'If it is a secret or API key, move it to a server-side environment variable.',
            'If it is expected (e.g., a product ID, nonce), you can safely ignore this finding.',
          ],
          fixAiPrompt: 'A high-entropy string was detected in my JavaScript bundle that may be a secret. Review my code for hardcoded credentials and move any secrets to server-side environment variables.',
        });
      }
    }
  }

  return findings;
}
