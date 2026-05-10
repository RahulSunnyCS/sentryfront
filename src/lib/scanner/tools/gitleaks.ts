/**
 * gitleaks wrapper — MIT licensed, safe for commercial use.
 * Scans JS bundle content for 700+ secret patterns.
 * Falls back gracefully if gitleaks is not installed.
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { findBinary, runTool } from './runner';
import type { RawFinding } from '../types';

interface GitleaksMatch {
  RuleID: string;
  Description: string;
  StartLine: number;
  Match: string;
  Secret: string;
  File: string;
  Entropy: number;
}

// Map gitleaks rule IDs to severity
function ruleToSeverity(ruleId: string): RawFinding['severity'] {
  if (/stripe.*live|twilio.*live|paypal.*live/i.test(ruleId)) return 'CRITICAL';
  if (/private.?key|rsa|pkcs/i.test(ruleId)) return 'CRITICAL';
  if (/aws.*key|gcp.*key|azure.*key/i.test(ruleId)) return 'CRITICAL';
  if (/github.*token|gitlab.*token|npm.*token/i.test(ruleId)) return 'CRITICAL';
  if (/openai|anthropic|cohere|replicate/i.test(ruleId)) return 'CRITICAL';
  if (/stripe.*test|sendgrid|mailgun|twilio/i.test(ruleId)) return 'HIGH';
  return 'HIGH';
}

function redact(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

export async function runGitleaks(
  sources: Array<{ label: string; content: string }>,
): Promise<RawFinding[]> {
  const binary = findBinary('gitleaks');
  if (!binary) return []; // not installed — caller falls back to regex

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibesafe-gl-'));
  const reportFile = path.join(tmpDir, 'report.json');
  const findings: RawFinding[] = [];
  const seenRules = new Set<string>();

  try {
    for (const { label, content } of sources) {
      if (!content.trim()) continue;

      const srcFile = path.join(tmpDir, 'source.js');
      fs.writeFileSync(srcFile, content, 'utf8');

      await runTool(
        binary,
        ['detect', '--source', srcFile, '--no-git', '-f', 'json', '-r', reportFile, '--exit-code', '0'],
        { timeoutMs: 20_000 },
      );

      if (!fs.existsSync(reportFile)) continue;
      const raw = fs.readFileSync(reportFile, 'utf8').trim();
      if (!raw || raw === 'null') continue;

      let matches: GitleaksMatch[];
      try { matches = JSON.parse(raw) as GitleaksMatch[]; }
      catch { continue; }

      for (const match of matches) {
        const key = match.RuleID;
        if (seenRules.has(key)) continue;
        seenRules.add(key);

        findings.push({
          moduleId: 'P1-01',
          severity: ruleToSeverity(match.RuleID),
          category: 'Client-Side Secret Exposure',
          title: `${match.Description} detected in client-side JavaScript`,
          location: label,
          evidence: `Rule: ${match.RuleID} | Line ${match.StartLine}: ${redact(match.Secret)}`,
          explanation: `gitleaks detected a ${match.Description} in your JavaScript bundle. This credential is exposed to anyone who views source in browser devtools.`,
          impact: 'Attackers can use this credential to access the associated service with full API permissions.',
          fixManual: [
            'Remove the secret from client-side code immediately.',
            'Move any API call using this credential to a server-side route.',
            'Rotate the credential now — assume it has been read.',
            'Store secrets in server-side environment variables only.',
          ],
          fixAiPrompt: `gitleaks found a ${match.Description} in my JavaScript bundle (rule: ${match.RuleID}). Move the API call using this credential to a Next.js server route so it never reaches the browser.`,
        });
      }

      // Clean up report for next iteration
      try { fs.unlinkSync(reportFile); } catch { /* ok */ }
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  }

  return findings;
}
