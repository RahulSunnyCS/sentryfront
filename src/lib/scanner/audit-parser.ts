/**
 * PageSpeed Insights Audit Parser
 * 
 * Handles different audit detail formats from Lighthouse:
 * - opportunity: Performance opportunities (unused JS, images, etc.)
 * - table: Data tables (bootup time, third-party scripts, etc.)
 * - debugdata: Diagnostic data
 * - list: Simple lists
 * - treemap-data: Bundle analysis data
 */

export interface ParsedAuditItem {
  // Performance audit fields
  url?: string;
  wastedBytes?: number;
  wastedMs?: number;
  wastedPercent?: number;
  totalBytes?: number;
  label?: string;
  // Accessibility audit fields
  node?: {
    selector?: string;
    snippet?: string;
    nodeLabel?: string;
  };
  selector?: string;
  snippet?: string;
  [key: string]: unknown; // Allow other fields
}

export interface ParsedAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  type: string | null; // opportunity, table, debugdata, list, treemap-data
  items: ParsedAuditItem[];
  overallSavingsBytes?: number;
  overallSavingsMs?: number;
}

/**
 * Parse any Lighthouse audit into a normalized format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAudit(auditId: string, audit: any): ParsedAudit {
  const parsed: ParsedAudit = {
    id: auditId,
    title: audit.title || auditId,
    description: audit.description || '',
    score: audit.score ?? null,
    displayValue: audit.displayValue,
    type: audit.details?.type || null,
    items: [],
  };

  // No details - return early
  if (!audit.details) {
    return parsed;
  }

  const details = audit.details;

  // Store overall savings if available
  if (details.overallSavingsBytes !== undefined) {
    parsed.overallSavingsBytes = details.overallSavingsBytes;
  }
  if (details.overallSavingsMs !== undefined) {
    parsed.overallSavingsMs = details.overallSavingsMs;
  }

  // Parse based on type
  switch (details.type) {
    case 'opportunity':
      parsed.items = parseOpportunityItems(details.items || []);
      break;
    
    case 'table':
      parsed.items = parseTableItems(details.items || [], details.headings || []);
      break;
    
    case 'list':
      parsed.items = parseListItems(details.items || []);
      break;
    
    case 'debugdata':
      parsed.items = parseDebugDataItems(details.items || []);
      break;
    
    case 'treemap-data':
      // Treemap data is complex, we'll skip it for now
      parsed.items = [];
      break;
    
    default:
      // Unknown type - try to extract items if they exist
      if (Array.isArray(details.items)) {
        parsed.items = details.items.map((item: unknown) => item as ParsedAuditItem);
      }
  }

  return parsed;
}

/**
 * Parse opportunity items (e.g., unused-javascript)
 * Format: { url, wastedBytes, wastedPercent, totalBytes }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOpportunityItems(items: any[]): ParsedAuditItem[] {
  return items.map(item => ({
    url: item.url,
    wastedBytes: item.wastedBytes,
    wastedMs: item.wastedMs,
    wastedPercent: item.wastedPercent,
    totalBytes: item.totalBytes,
    // Include any other fields
    ...Object.fromEntries(
      Object.entries(item).filter(([key]) => 
        !['url', 'wastedBytes', 'wastedMs', 'wastedPercent', 'totalBytes'].includes(key)
      )
    ),
  }));
}

/**
 * Parse table items (e.g., bootup-time, third-party-summary)
 * Format varies based on headings
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function parseTableItems(items: any[], _headings: any[]): ParsedAuditItem[] {
  return items.map(item => {
    const parsed: ParsedAuditItem = {};
    
    // Extract URL if it exists (common field)
    if (item.url) {
      parsed.url = item.url;
    }
    
    // Extract common fields
    if (item.wastedBytes !== undefined) parsed.wastedBytes = item.wastedBytes;
    if (item.wastedMs !== undefined) parsed.wastedMs = item.wastedMs;
    if (item.totalBytes !== undefined) parsed.totalBytes = item.totalBytes;
    if (item.label !== undefined) parsed.label = item.label;
    
    // Include all other fields as-is
    Object.keys(item).forEach(key => {
      if (!(key in parsed)) {
        parsed[key] = item[key];
      }
    });
    
    return parsed;
  });
}

/**
 * Parse list items
 * Format: Simple array of objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseListItems(items: any[]): ParsedAuditItem[] {
  return items.map(item => ({
    ...item,
  }));
}

/**
 * Parse debug data items
 * Format: Key-value pairs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDebugDataItems(items: any[]): ParsedAuditItem[] {
  return items.map(item => ({
    ...item,
  }));
}
