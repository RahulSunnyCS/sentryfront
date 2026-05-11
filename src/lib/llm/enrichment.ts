import type { RawFinding } from '@/lib/scanner/types';

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessageResponse {
  content?: Array<AnthropicTextBlock | { type: string; [key: string]: unknown }>;
}

interface FindingEnrichment {
  index: number;
  explanation?: unknown;
  impact?: unknown;
  fix_ai_prompt?: unknown;
}

interface EnrichmentStatus {
  enabled: boolean;
  used: boolean;
  reason?: string;
  model?: string;
}

export interface EnrichmentResult {
  findings: RawFinding[];
  status: EnrichmentStatus;
}

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_FINDINGS_PER_PROMPT = 40;
const MAX_TEXT_FIELD_LENGTH = 1_200;

const SYSTEM_PROMPT = `You are a security analyst writing concise remediation guidance for a web security scanner.
You only enrich findings that were already detected by deterministic scanner modules.
Never add new findings, never upgrade severity, never invent evidence, and never include unredacted secrets.
Return only valid JSON: an array of objects with index, explanation, impact, and fix_ai_prompt.`;

function llmDisabledByConfig(): boolean {
  const flag = process.env.LLM_ENRICHMENT_ENABLED?.trim().toLowerCase();
  return flag === 'false' || flag === '0' || flag === 'off';
}

function truncate(value: string, maxLength = MAX_TEXT_FIELD_LENGTH): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…[truncated]`;
}

function maskSensitiveText(value: string): string {
  return value
    // Common API key / bearer-token assignment patterns.
    .replace(
      /((?:api[_-]?key|secret|token|authorization|password|passwd|pwd|session|cookie|sessionid)\s*[:=]\s*["']?)([^"'\s;]{8,})/gi,
      (_match, prefix: string, secret: string) => `${prefix}${maskToken(secret)}`,
    )
    // JWT-like values.
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, (token) => maskToken(token))
    // Stripe-style live/test keys and similar long opaque keys.
    .replace(/\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, (token) => maskToken(token))
    // Set-Cookie headers
    .replace(/Set-Cookie:\s*([^=]+)=([^;\s]+)/gi, (_match, name: string, value: string) =>
      `Set-Cookie: ${name}=${maskToken(value)}`,
    )
    // Authorization: Bearer <token>
    .replace(/Authorization:\s*Bearer\s+([A-Za-z0-9\-_\.]+)/gi, (_match, token: string) =>
      `Authorization: Bearer ${maskToken(token)}`,
    )
    // Authorization: Basic <base64>
    .replace(/Authorization:\s*Basic\s+([A-Za-z0-9+/=]+)/gi, (_match, token: string) =>
      `Authorization: Basic ${maskToken(token)}`,
    )
    // Email addresses (optional - redact local part for privacy)
    .replace(/\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z]{2,})\b/gi, (_match, local: string, domain: string) =>
      local.length > 1 ? `${local[0]}***@${domain}` : `***@${domain}`,
    );
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

function buildPrompt(targetUrl: string, stack: string, findings: RawFinding[]): string {
  const promptFindings = findings.slice(0, MAX_FINDINGS_PER_PROMPT).map((finding, index) => ({
    index,
    module_id: finding.moduleId,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    location: truncate(finding.location, 500),
    evidence: truncate(maskSensitiveText(finding.evidence)),
    current_explanation: truncate(maskSensitiveText(finding.explanation)),
    current_impact: truncate(maskSensitiveText(finding.impact)),
    current_fix_ai_prompt: truncate(maskSensitiveText(finding.fixAiPrompt)),
    fix_manual: finding.fixManual.map((step) => truncate(maskSensitiveText(step), 500)),
  }));

  return JSON.stringify({
    task: 'Enrich these deterministic scan findings for a non-expert builder using Cursor, Lovable, or Bolt.',
    constraints: [
      'Return a JSON array only; do not wrap it in Markdown.',
      'Use the provided index to identify each finding.',
      'Do not create, remove, merge, reorder, or reclassify findings.',
      'Keep explanations and impacts under 90 words each.',
      'Make fix_ai_prompt concrete and copy-paste-ready for an AI coding assistant.',
      'Do not include raw secrets, cookies, credentials, or personal data.',
    ],
    target: { url: targetUrl, detected_stack: stack },
    findings: promptFindings,
  });
}

function extractText(response: AnthropicMessageResponse): string | null {
  const textParts = response.content
    ?.filter((block): block is AnthropicTextBlock => block.type === 'text' && typeof (block as AnthropicTextBlock).text === 'string')
    .map((block) => block.text.trim()) ?? [];

  return textParts.length > 0 ? textParts.join('\n') : null;
}

function parseJsonArray(text: string): FindingEnrichment[] | null {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed as FindingEnrichment[] : null;
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      return Array.isArray(parsed) ? parsed as FindingEnrichment[] : null;
    } catch {
      return null;
    }
  }
}

function applyEnrichment(findings: RawFinding[], enrichments: FindingEnrichment[]): RawFinding[] {
  const enriched = findings.map((finding) => ({ ...finding }));

  for (const item of enrichments) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= enriched.length) continue;

    const target = enriched[item.index];
    const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';
    const impact = typeof item.impact === 'string' ? item.impact.trim() : '';
    const fixAiPrompt = typeof item.fix_ai_prompt === 'string' ? item.fix_ai_prompt.trim() : '';

    enriched[item.index] = {
      ...target,
      explanation: explanation || target.explanation,
      impact: impact || target.impact,
      fixAiPrompt: fixAiPrompt || target.fixAiPrompt,
    };
  }

  return enriched;
}

export async function enrichFindingsWithLLM(
  findings: RawFinding[],
  context: { targetUrl: string; stack: string },
): Promise<EnrichmentResult> {
  if (findings.length === 0) {
    return { findings, status: { enabled: false, used: false, reason: 'no_findings' } };
  }

  if (llmDisabledByConfig()) {
    return { findings, status: { enabled: false, used: false, reason: 'disabled_by_config' } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { findings, status: { enabled: false, used: false, reason: 'missing_api_key' } };
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.LLM_ENRICHMENT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3_000,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: buildPrompt(context.targetUrl, context.stack, findings) },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[llm] enrichment skipped: Anthropic API returned HTTP ${response.status}`);
      return { findings, status: { enabled: true, used: false, reason: `http_${response.status}`, model } };
    }

    const json = await response.json() as AnthropicMessageResponse;
    const text = extractText(json);
    if (!text) {
      console.warn('[llm] enrichment skipped: Anthropic response did not contain text output');
      return { findings, status: { enabled: true, used: false, reason: 'empty_response', model } };
    }

    const parsed = parseJsonArray(text);
    if (!parsed) {
      console.warn('[llm] enrichment skipped: Anthropic response was not a JSON array');
      return { findings, status: { enabled: true, used: false, reason: 'invalid_json', model } };
    }

    return {
      findings: applyEnrichment(findings, parsed),
      status: { enabled: true, used: true, model },
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'request_failed';
    console.warn(`[llm] enrichment skipped: ${reason}`, error);
    return { findings, status: { enabled: true, used: false, reason, model } };
  } finally {
    clearTimeout(timeout);
  }
}
