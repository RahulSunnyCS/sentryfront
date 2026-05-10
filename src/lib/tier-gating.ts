/**
 * Tier-Based Gating Logic
 * 
 * Enforces tier restrictions on findings and features.
 * When TIER_GATING_ENABLED=false, all users get full access.
 */

import { features } from './features';
import type { Finding } from '@/types';

// ── Tier Limits ──────────────────────────────────────────────────────────────

export const TIER_LIMITS = {
  free: {
    maxFindings: 5,
    allowPdfExport: false,
    allowScanDiff: false,
    scansPerMonth: 1,
  },
  'one-shot': {
    maxFindings: Infinity,
    allowPdfExport: true,
    allowScanDiff: false,
    scansPerMonth: 1, // One-shot is for a single scan
  },
  pro: {
    maxFindings: Infinity,
    allowPdfExport: true,
    allowScanDiff: true,
    scansPerMonth: Infinity,
  },
  studio: {
    maxFindings: Infinity,
    allowPdfExport: true,
    allowScanDiff: true,
    scansPerMonth: Infinity,
  },
} as const;

export type UserTier = keyof typeof TIER_LIMITS;

// ── Gating Functions ─────────────────────────────────────────────────────────

/**
 * Apply tier restrictions to findings list
 * Returns limited findings + metadata about restrictions
 */
export function applyTierGating(findings: Finding[], tier: string = 'free') {
  // If tier gating is disabled, return all findings
  if (!features.tierGating) {
    return {
      findings,
      isLimited: false,
      tier,
      limit: null,
      total: findings.length,
    };
  }

  const userTier = tier as UserTier;
  const limits = TIER_LIMITS[userTier] || TIER_LIMITS.free;

  if (limits.maxFindings === Infinity || findings.length <= limits.maxFindings) {
    // No limitation needed
    return {
      findings,
      isLimited: false,
      tier: userTier,
      limit: null,
      total: findings.length,
    };
  }

  // Limit findings to max allowed
  // Prioritize by severity: CRITICAL > HIGH > MEDIUM > LOW > INFO
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const sorted = [...findings].sort((a, b) => {
    return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  });

  const limited = sorted.slice(0, limits.maxFindings);

  return {
    findings: limited,
    isLimited: true,
    tier: userTier,
    limit: limits.maxFindings,
    total: findings.length,
    hiddenCount: findings.length - limits.maxFindings,
  };
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(tier: string, feature: 'pdfExport' | 'scanDiff'): boolean {
  // If tier gating is disabled, everyone can access everything
  if (!features.tierGating) {
    return true;
  }

  const userTier = tier as UserTier;
  const limits = TIER_LIMITS[userTier] || TIER_LIMITS.free;

  if (feature === 'pdfExport') {
    return limits.allowPdfExport;
  }

  if (feature === 'scanDiff') {
    return limits.allowScanDiff;
  }

  return false;
}

/**
 * Get upgrade message based on user's current tier
 */
export function getUpgradeMessage(tier: string): string {
  if (tier === 'free') {
    return 'Upgrade to Pro to see all findings and unlock advanced features.';
  }

  if (tier === 'one-shot') {
    return 'Upgrade to Pro for unlimited scans and scan comparison.';
  }

  return '';
}

/**
 * Check if tier gating is enabled
 */
export function isTierGatingEnabled(): boolean {
  return features.tierGating;
}
