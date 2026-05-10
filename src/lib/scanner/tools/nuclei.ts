/**
 * Nuclei wrapper — MIT licensed, safe for commercial use.
 * Runs template-based scans for exposures and misconfigurations.
 * Falls back gracefully if nuclei or templates are not installed.
 */

import { existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findBinary, runTool } from './runner';
import type { RawFinding } from '../types';

interface NucleiResult {
  template: string;
  'template-id': string;
  info: {
    name: string;
    severity: string;
    description?: string;
    tags?: string[];
  };
  host: string;
  matched?: string;
  'extracted-results'?: string[];
}

// Template tags to run — passive, safe, no active exploitation
const TEMPLATE_TAGS = [
  'exposure',
  'config',
  'misconfig',
  'panel',
  'exposure,config',
].join(',');

const SEVERITY_MAP: Record<string, RawFinding['severity']> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO',
  unknown: 'INFO',
};

function findTemplatesDir(): string | null {
  const candidates = [
    path.join(os.homedir(), 'nuclei-templates'),
    path.join(os.homedir(), '.nuclei-templates'),
    '/root/nuclei-templates',
    '/root/.nuclei-templates',
    path.join(os.homedir(), '.config', 'nuclei', 'templates'),
  ];
  return candidates.find(existsSync) ?? null;
}

export async function runNuclei(targetUrl: string): Promise<RawFinding[]> {
  const binary = findBinary('nuclei');
  if (!binary) return [];

  const templatesDir = findTemplatesDir();
  if (!templatesDir) return []; // templates not downloaded

  const findings: RawFinding[] = [];

  const result = await runTool(
    binary,
    [
      '-u', targetUrl,
      '-tags', TEMPLATE_TAGS,
      '-j',             // JSONL output
      '-silent',
      '-no-color',
      '-timeout', '10',
      '-retries', '0',
      '-rate-limit', '20',
    ],
    { timeoutMs: 60_000 },
  );

  if (!result.stdout.trim()) return findings;

  for (const line of result.stdout.trim().split('\n')) {
    if (!line.trim()) continue;
    let hit: NucleiResult;
    try { hit = JSON.parse(line) as NucleiResult; }
    catch { continue; }

    const severity = SEVERITY_MAP[hit.info.severity?.toLowerCase()] ?? 'INFO';
    const matched = hit.matched ?? hit.host;
    const matchPath = (() => {
      try { return new URL(matched).pathname; } catch { return matched; }
    })();

    findings.push({
      moduleId: 'P1-06',
      severity,
      category: 'Nuclei: Misconfiguration / Exposure',
      title: hit.info.name,
      location: matchPath,
      evidence: [
        `Template: ${hit['template-id']}`,
        `Matched: ${matched}`,
        ...(hit['extracted-results'] ?? []).slice(0, 2),
      ].join('\n'),
      explanation: hit.info.description ?? `Nuclei detected a misconfiguration or exposure at ${matchPath} using template ${hit['template-id']}.`,
      impact: `A ${severity.toLowerCase()}-severity misconfiguration was detected. Review the matched URL and template description for specific risk details.`,
      fixManual: [
        `Review ${matchPath} and determine whether it should be publicly accessible.`,
        'Add authentication or disable the exposed resource.',
        `See the full template details: https://github.com/projectdiscovery/nuclei-templates/tree/main/${hit.template}`,
      ],
      fixAiPrompt: `Nuclei detected "${hit.info.name}" at ${matchPath}. Help me restrict access to this endpoint or remove the misconfiguration from my web server configuration.`,
    });
  }

  return findings;
}
