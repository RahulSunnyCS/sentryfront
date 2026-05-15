import type { RawFinding } from '../types';
import type { ApkContents } from '../apk-analyzer';
import { XMLParser } from 'fast-xml-parser';

interface DomainConfig {
  cleartextPermitted: boolean;
  domains: string[];
}

function parseNetworkSecurityConfig(xml: string): DomainConfig[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'domain-config' || name === 'domain',
  });

  try {
    const doc = parser.parse(xml);
    const root = doc?.['network-security-config'];
    if (!root) return [];

    const results: DomainConfig[] = [];

    const configs: unknown[] = Array.isArray(root?.['domain-config'])
      ? (root['domain-config'] as unknown[])
      : root?.['domain-config']
        ? [root['domain-config']]
        : [];

    for (const cfg of configs) {
      const c = cfg as Record<string, unknown>;
      const cleartextRaw = (c['@_cleartextTrafficPermitted'] as string | undefined) ?? '';
      const cleartext = cleartextRaw.toLowerCase() === 'true';
      if (!cleartext) continue;

      const domainNodes: unknown[] = Array.isArray(c['domain'])
        ? (c['domain'] as unknown[])
        : c['domain']
          ? [c['domain']]
          : [];

      const domains = domainNodes.map((d) =>
        typeof d === 'string' ? d : (d as Record<string, unknown>)?.['#text'] ?? String(d)
      );

      results.push({ cleartextPermitted: true, domains });
    }

    // Check base-config for global cleartext
    const baseConfig = root?.['base-config'] as Record<string, unknown> | undefined;
    if (baseConfig) {
      const cleartextRaw = (baseConfig['@_cleartextTrafficPermitted'] as string | undefined) ?? '';
      if (cleartextRaw.toLowerCase() === 'true') {
        results.push({ cleartextPermitted: true, domains: ['*'] });
      }
    }

    return results;
  } catch {
    return [];
  }
}

export function runCleartextTrafficModule(apk: ApkContents): RawFinding[] {
  const findings: RawFinding[] = [];

  const nscXml = apk.networkSecurityConfig;
  if (!nscXml) return findings;

  const cleartextConfigs = parseNetworkSecurityConfig(nscXml);
  if (cleartextConfigs.length === 0) return findings;

  const allDomains = cleartextConfigs.flatMap((c) => c.domains);
  const isGlobal = allDomains.includes('*');
  const domainList = isGlobal ? 'all domains (wildcard)' : allDomains.slice(0, 5).join(', ');

  findings.push({
    moduleId: 'M1-03',
    severity: isGlobal ? 'CRITICAL' : 'HIGH',
    category: 'Network Security',
    title: `Cleartext HTTP traffic permitted${isGlobal ? ' for all domains' : ''}`,
    location: 'res/xml/network_security_config.xml',
    evidence: `cleartextTrafficPermitted="true" for: ${domainList}`,
    explanation: `The app's network security configuration explicitly allows unencrypted HTTP traffic${isGlobal ? ' to all destinations' : ` to: ${domainList}`}. This means API calls and data can be intercepted on any untrusted network.`,
    impact: 'Credentials, session tokens, and sensitive data transmitted to these domains are visible to anyone performing a man-in-the-middle attack on the same network.',
    fixManual: [
      'Remove or set cleartextTrafficPermitted="false" in network_security_config.xml.',
      'Migrate all affected endpoints to HTTPS.',
      'If a third-party SDK forces cleartext, contact the SDK vendor for a HTTPS version.',
      'Set android:usesCleartextTraffic="false" in AndroidManifest.xml as a defence-in-depth measure.',
    ],
    fixAiPrompt: `My Android app's network_security_config.xml allows cleartext traffic for ${domainList}. Remove the cleartext permission, migrate endpoints to HTTPS, and ensure usesCleartextTraffic="false" in the manifest.`,
    confidence: 'high',
  });

  return findings;
}
