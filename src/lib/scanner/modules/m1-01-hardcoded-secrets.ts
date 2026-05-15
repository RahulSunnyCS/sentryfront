import type { RawFinding } from '../types';
import type { ApkContents } from '../apk-analyzer';

// Secret patterns reused from the web scanner (same risk, different surface)
const SECRET_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  category: string;
}> = [
  {
    name: 'Stripe live secret key',
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'OpenAI API key',
    pattern: /sk-(?:proj-)?[A-Za-z0-9_\-]{32,}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'AWS access key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'GitHub personal access token',
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'Generic API key assignment',
    pattern: /(?:api[_-]?key|apikey|secret|token|password|passwd|pwd)\s*[=:]\s*["']([A-Za-z0-9\-_\.]{16,})/gi,
    category: 'Hardcoded Credential',
  },
  {
    name: 'Firebase config API key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'RSA/EC private key',
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    category: 'Hardcoded Private Key',
  },
  {
    name: 'Google OAuth client secret',
    pattern: /GOCSPX-[A-Za-z0-9_-]{28}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'Slack token',
    pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/g,
    category: 'Hardcoded API Secret',
  },
  {
    name: 'Database connection string',
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\s"']+/gi,
    category: 'Hardcoded Database Credential',
  },
];

// Skip binary-looking files (high non-printable byte ratio) and generated resource files
const SKIP_PATHS = /^(?:res\/drawable|res\/mipmap|res\/font|META-INF\/|classes\d*\.dex)/i;

export function runMobileSecretsModule(apk: ApkContents): RawFinding[] {
  const findings: RawFinding[] = [];
  const seen = new Set<string>();

  for (const [relPath, content] of apk.textFiles) {
    if (SKIP_PATHS.test(relPath)) continue;

    for (const { name, pattern, category } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (!match) continue;

      // Redact beyond first 8 chars
      const raw = match[0];
      const redacted = raw.length > 8 ? `${raw.slice(0, 8)}…[redacted]` : raw;
      const dedupeKey = `${category}:${relPath}:${raw.slice(0, 12)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Get line number
      const lineNo = content.slice(0, match.index).split('\n').length;

      findings.push({
        moduleId: 'M1-01',
        severity: category.includes('Private Key') || raw.startsWith('sk_live_') ? 'CRITICAL' : 'HIGH',
        category,
        title: `${name} hardcoded in app binary`,
        location: `${relPath}:${lineNo}`,
        evidence: redacted,
        explanation: `A ${name.toLowerCase()} is embedded directly in the app's source code or resource files. Anyone who decompiles the APK (a trivial operation) can extract this credential and use it against your backend.`,
        impact: 'Full credential compromise. Attackers can access your backend services, databases, or APIs using the extracted key without any additional effort.',
        fixManual: [
          'Remove the hardcoded credential from the source code immediately.',
          'Rotate / revoke the exposed credential in the service dashboard.',
          'Store secrets in environment variables injected at build time or fetch them from a secure secrets manager at runtime.',
          'For Android: never store secrets in BuildConfig, strings.xml, or assets — use Android Keystore or a secrets management API.',
        ],
        fixAiPrompt: `A ${name.toLowerCase()} is hardcoded in my Android app at ${relPath}. Remove it from the source, rotate the credential, and implement a secure secrets retrieval strategy using Android Keystore or a remote config endpoint.`,
        confidence: 'high',
      });
    }
  }

  return findings;
}
