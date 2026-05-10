import { promises as dns } from 'dns';
import type { CrawlResult, RawFinding } from '../types';

async function getTxtRecords(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((r) => r.join(''));
  } catch {
    return [];
  }
}

function parseSPF(records: string[]): string | null {
  return records.find((r) => r.startsWith('v=spf1')) ?? null;
}

function parseDMARC(records: string[]): string | null {
  return records.find((r) => r.startsWith('v=DMARC1')) ?? null;
}

export async function runDnsEmailModule(crawl: CrawlResult): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const hostname = new URL(crawl.finalUrl).hostname;
  // Use apex domain for email records
  const parts = hostname.split('.');
  const apex = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

  const [apexTxt, dmarcTxt] = await Promise.all([
    getTxtRecords(apex),
    getTxtRecords(`_dmarc.${apex}`),
  ]);

  // SPF
  const spf = parseSPF(apexTxt);
  if (!spf) {
    findings.push({
      moduleId: 'P1-10',
      severity: 'MEDIUM',
      category: 'DNS & Email Security',
      title: 'No SPF record found',
      location: `DNS TXT @ ${apex}`,
      evidence: `No v=spf1 record found for ${apex}`,
      explanation: 'SPF (Sender Policy Framework) specifies which mail servers are authorised to send email on behalf of your domain. Without SPF, anyone can send email appearing to come from your domain.',
      impact: 'Your domain can be used to send phishing emails to your users and customers. This damages brand trust and can get your domain blacklisted.',
      fixManual: [
        `Add a DNS TXT record for ${apex}: v=spf1 include:_spf.your-mail-provider.com -all`,
        'Replace the include: value with your actual email provider (e.g., include:_spf.google.com for Google Workspace).',
        'Use -all (hard fail) rather than ~all (soft fail) for stricter enforcement.',
      ],
      fixAiPrompt: `My domain ${apex} has no SPF record. Create an SPF DNS TXT record for my email provider to prevent domain spoofing.`,
    });
  } else if (spf.includes('~all')) {
    findings.push({
      moduleId: 'P1-10',
      severity: 'LOW',
      category: 'DNS & Email Security',
      title: 'SPF record uses soft fail (~all) instead of hard fail (-all)',
      location: `DNS TXT @ ${apex}`,
      evidence: spf,
      explanation: '~all (soft fail) only marks unauthorised emails as suspicious — it does not reject them. Many spam filters treat soft-fail messages as legitimate, giving little protection against spoofing.',
      impact: 'Phishing emails spoofing your domain may still reach recipients\' inboxes.',
      fixManual: [
        `Change ~all to -all in your SPF record to hard-fail unauthorised senders.`,
        `Updated record: ${spf.replace('~all', '-all')}`,
        'Monitor for legitimate mail being blocked for 1-2 weeks after the change.',
      ],
      fixAiPrompt: `My SPF record uses ~all (soft fail). Change it to -all (hard fail) to prevent phishing emails from my domain.`,
    });
  }

  // DMARC
  const dmarc = parseDMARC(dmarcTxt);
  if (!dmarc) {
    findings.push({
      moduleId: 'P1-10',
      severity: 'MEDIUM',
      category: 'DNS & Email Security',
      title: 'No DMARC record found',
      location: `DNS TXT @ _dmarc.${apex}`,
      evidence: `No v=DMARC1 record found for _dmarc.${apex}`,
      explanation: 'DMARC tells receiving mail servers what to do when an email fails SPF or DKIM checks. Without DMARC, there is no policy for handling spoofed emails.',
      impact: 'Even with SPF and DKIM configured, receiving servers have no policy to follow when verification fails — spoofed emails may still reach inboxes.',
      fixManual: [
        `Add a DNS TXT record for _dmarc.${apex}: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${apex}`,
        'Start with p=none to monitor (no action), then move to p=quarantine, then p=reject.',
        'The rua= address receives aggregate reports so you can monitor legitimate mail flow.',
      ],
      fixAiPrompt: `My domain ${apex} has no DMARC record. Create a DMARC DNS record starting with p=quarantine to prevent phishing emails that spoof my domain.`,
    });
  } else if (dmarc.includes('p=none')) {
    findings.push({
      moduleId: 'P1-10',
      severity: 'LOW',
      category: 'DNS & Email Security',
      title: 'DMARC policy is set to none (monitoring only)',
      location: `DNS TXT @ _dmarc.${apex}`,
      evidence: dmarc,
      explanation: 'p=none means DMARC is in monitoring mode only — no action is taken on emails that fail authentication. This does not protect against spoofing.',
      impact: 'Spoofed emails still reach recipients. DMARC reporting data is collected but not acted upon.',
      fixManual: [
        'After reviewing DMARC aggregate reports for 2-4 weeks, change p=none to p=quarantine.',
        'Once confident, escalate to p=reject for maximum protection.',
        `Updated record: ${dmarc.replace('p=none', 'p=quarantine')}`,
      ],
      fixAiPrompt: `My DMARC record uses p=none. Upgrade it to p=quarantine to actively protect against phishing emails spoofing my domain.`,
    });
  }

  return findings;
}
