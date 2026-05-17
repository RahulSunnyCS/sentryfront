'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PerformanceGrade } from './performance-grade';
import { CoreWebVitals } from './core-web-vitals';
import { AIImprovementSuggestions } from './ai-improvement-suggestions';
import type { PerformanceData } from '@/types';

/**
 * PerformanceSection Component
 * Main container for performance metrics and AI suggestions.
 *
 * SECURITY: all strings from scanned-site-derived data (CrUX verdicts,
 * best-practices grades) are rendered as plain React text — never via
 * dangerouslySetInnerHTML. Untrusted strings are length-capped before render.
 *
 * INVARIANTS:
 *   - performanceScore === null → provider was unavailable (UNAVAILABLE state)
 *   - performanceScore === 0   → real score for worst-performing site (not missing)
 *   - Desktop data (when present) is subordinate — never drives the headline grade
 *   - Real-users-SLOW banner is mobile-only (never shown for desktop sub-section)
 */

// Maximum length for any string derived from the scanned site (CrUX data, grades).
// Prevents an oversized payload from breaking layout or the DOM.
const MAX_STRING_LEN = 64;

/**
 * Cap a string at MAX_STRING_LEN chars. Applied to any value that could
 * originate from scanned-site data to prevent payload injection.
 * React's JSX rendering escapes the result — no dangerouslySetInnerHTML needed.
 */
function capString(s: string | undefined | null): string {
  if (!s) return '';
  return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) : s;
}

interface ImprovementSuggestion {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  aiPrompt: string;
  estimatedImpact: string;
  estimatedEffort: string;
  relatedFindings: string[];
}

interface PerformanceSuggestions {
  scanId: string;
  targetUrl: string;
  performanceGrade: string;
  performanceScore: number;
  summary: string;
  quickWins: ImprovementSuggestion[];
  majorImprovements: ImprovementSuggestion[];
  optimizations: ImprovementSuggestion[];
  aiPromptBundle: string;
  meta: {
    totalSuggestions: number;
    quickWinsCount: number;
    majorImprovementsCount: number;
    optimizationsCount: number;
  };
}

interface PerformanceSectionProps {
  scanId: string;
  performanceData: PerformanceData;
}

/**
 * Maps CrUX overallCategory ('FAST' | 'AVERAGE' | 'SLOW') to the correct
 * i18n key suffix. The verbatim verdict from Google is preserved — we do NOT
 * compute our own threshold-based bucket.
 */
function getRealUserVerdictKey(
  category: string | undefined | null,
): 'realUserVerdictFast' | 'realUserVerdictAverage' | 'realUserVerdictSlow' | null {
  if (!category) return null;
  if (category === 'FAST') return 'realUserVerdictFast';
  if (category === 'AVERAGE') return 'realUserVerdictAverage';
  if (category === 'SLOW') return 'realUserVerdictSlow';
  return null;
}

/** Badge colours for the real-user verdict chip */
const VERDICT_CHIP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FAST:    { bg: '#10b98133', text: '#10b981', border: '#10b981' },
  AVERAGE: { bg: '#f59e0b33', text: '#f59e0b', border: '#f59e0b' },
  SLOW:    { bg: '#ef444433', text: '#ef4444', border: '#ef4444' },
};

export function PerformanceSection({ scanId, performanceData }: PerformanceSectionProps) {
  // The 'report' namespace maps to messages/en.json → report.performance.*
  const t = useTranslations('report');

  const [suggestions, setSuggestions] = useState<PerformanceSuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // True when the PSI/Lighthouse provider was unavailable (null score).
  // A genuine score of 0 is NOT unavailable — the provider ran and returned 0.
  const scoreUnavailable = performanceData.performanceScore === null;

  // Pull all fields from performanceMetrics (may be null for old blobs).
  const metrics = performanceData.performanceMetrics;

  // CrUX field verdict (FAST / AVERAGE / SLOW). Sourced from performanceMetrics
  // because T-08 stored it inside the metrics block for structural consistency.
  const fieldDataVerdict: string | null | undefined = metrics?.fieldDataVerdict;
  const fieldData = metrics?.fieldData;
  // overallCategory is the canonical field-level verdict from CrUX.
  // Fall back to fieldDataVerdict (string form stored by T-06) when full fieldData
  // is not present — this supports pre-T-06 blobs that only stored the verdict string.
  const overallCategory: string | null =
    fieldData?.overallCategory ?? fieldDataVerdict ?? null;

  // Best-practices grade and score (optional — absent in old blobs).
  const bestPracticesGrade = capString(metrics?.bestPracticesGrade ?? 'N/A');
  const bestPracticesScore = metrics?.bestPracticesScore ?? null;

  // Desktop sub-object (only present when feature flag is on AND mobile PSI succeeded).
  // Desktop is NEVER used to drive the headline grade.
  const desktop = metrics?.desktop ?? null;

  // Verdict key for the i18n lookup — null when no field data
  const verdictKey = getRealUserVerdictKey(overallCategory);

  // Show the real-users-slow banner ONLY when:
  //   1. The mobile verdict is explicitly SLOW (from CrUX), AND
  //   2. There is a real lab score (not unavailable).
  // The P2-07 finding carries this signal — we consume it from the CrUX data
  // structure directly rather than re-deriving thresholds.
  const showSlowBanner = overallCategory === 'SLOW' && !scoreUnavailable;

  useEffect(() => {
    // When the provider was unavailable there is no performance score and
    // therefore no suggestions to fetch. Skip the request to avoid a 404
    // that would show alongside the 'not measured' banner.
    if (scoreUnavailable) {
      setLoading(false);
      return;
    }

    async function fetchSuggestions() {
      try {
        const res = await fetch(`/api/v1/scans/${scanId}/performance-suggestions`);
        if (!res.ok) {
          throw new Error('Failed to fetch performance suggestions');
        }
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Error fetching performance suggestions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [scanId, scoreUnavailable]);

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      padding: 32,
      marginBottom: 28,
    }}>
      {/* Real-users-slow banner: mobile-only, shown only when CrUX says SLOW
          AND the lab actually ran (score is not null). Desktop section never
          shows this banner — desktop data is always subordinate/informational. */}
      {showSlowBanner && (
        <div
          data-testid="real-users-slow-banner"
          role="alert"
          style={{
            backgroundColor: '#ef444414',
            border: '1px solid #ef444444',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 24,
            fontSize: 13,
            color: '#ef4444',
            fontWeight: 600,
          }}
        >
          {/* Plain text — t() returns a static i18n string (not site-derived) */}
          {t('performance.realUsersSlowBanner')}
        </div>
      )}

      {/* Header with Performance Grade + Real-user verdict + Best practices */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        {scoreUnavailable ? (
          // Provider was unavailable — render a neutral placeholder instead of
          // PerformanceGrade, which requires a non-null grade and score.
          <div style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            backgroundColor: 'var(--surface-secondary)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            flexShrink: 0,
          }}>
            —
          </div>
        ) : (
          // performanceScore is a real number (0 is valid — worst site score).
          // Non-null assertion is safe: scoreUnavailable guards the null branch.
          <PerformanceGrade
            grade={performanceData.performanceGrade!}
            score={performanceData.performanceScore!}
            size={120}
          />
        )}
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Performance Analysis
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>
            {scoreUnavailable
              // Null score means the provider was temporarily unavailable.
              // Use the i18n string so every locale shows the correct message.
              ? t('performance.scoreUnavailable')
              // For all real scores (including 0) use the threshold-based copy.
              : performanceData.performanceScore! >= 90
              ? 'Excellent performance! Your site loads fast and provides a great user experience.'
              : performanceData.performanceScore! >= 75
              ? 'Good performance, but there\'s room for improvement. Focus on Core Web Vitals.'
              : performanceData.performanceScore! >= 50
              ? 'Moderate performance. Addressing key issues will significantly improve user experience.'
              : 'Performance needs attention. Prioritize critical issues for maximum impact.'}
          </p>

          {/* Real-user verdict chip — Google's VERBATIM overallCategory label.
              We map the CrUX enum ('FAST'/'AVERAGE'/'SLOW') to an i18n key and
              render via t() — we do NOT compute our own Good/NI/Poor bucket.
              The verdict string comes from the i18n catalog (not site data)
              so it is not length-capped, but capString() guards the overallCategory
              raw value used only for colour lookup (never rendered directly). */}
          {verdictKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('performance.realUserLabel')}:
              </span>
              <span
                data-testid="real-user-verdict"
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 6,
                  // overallCategory used only for colour key (capped, never rendered as HTML)
                  ...VERDICT_CHIP_COLORS[capString(overallCategory)] ?? {},
                  border: `1px solid ${VERDICT_CHIP_COLORS[capString(overallCategory)]?.border ?? 'var(--border)'}`,
                }}
              >
                {/* Rendered via t() — i18n string, NOT site-derived data */}
                {t(`performance.${verdictKey}`)}
              </span>
            </div>
          )}

          {/* Best-practices grade and score (label from i18n; grade/score from scan data).
              Grade/score are length-capped — they originate from the Lighthouse run
              on the scanned site, which is attacker-chosen. */}
          {!scoreUnavailable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('performance.bestPracticesLabel')}:
              </span>
              <span
                data-testid="best-practices-grade"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}
              >
                {/* Render 'N/A' when score is null; grade is capped as a safety measure */}
                {bestPracticesScore !== null
                  ? `${capString(bestPracticesGrade)} (${bestPracticesScore})`
                  : 'N/A'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cache staleness note — shown below the headline, above the CWV metrics.
          This is a static i18n string (not site-derived), no escaping needed beyond
          React's default JSX rendering. */}
      {!scoreUnavailable && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          fontStyle: 'italic',
          marginBottom: 16,
        }}>
          {t('performance.cacheStalenessNote')}
        </div>
      )}

      {/* Mobile Core Web Vitals (lab + field data)
          CoreWebVitals accepts fieldData via metrics.fieldData — it handles
          the INP-from-field-only and lab/field distinction internally. */}
      <div style={{ marginBottom: 32 }}>
        <CoreWebVitals metrics={metrics ?? { lcp: null, fcp: null, cls: null, tbt: null, ttfb: null }} />
      </div>

      {/* Desktop performance sub-section — VISUALLY SUBORDINATE.
          Rendered only when the desktop block is present in the data.
          Rules:
            - Never shows the real-users-slow banner (desktop is informational)
            - Never drives the headline grade
            - Clearly labelled as subordinate with the desktopSubordinateNote disclaimer
            - Smaller type and secondary styling reinforce the subordinate role */}
      {desktop && (
        <div
          data-testid="desktop-section"
          style={{
            marginBottom: 32,
            padding: 20,
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            opacity: 0.85,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {t('performance.desktopSectionLabel')}
            </h3>
            {/* Desktop score chip — subordinate to the mobile headline */}
            {desktop.score !== null && (
              <span
                data-testid="desktop-score"
                style={{
                  fontSize: 12, fontWeight: 700,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '2px 8px', color: 'var(--text-secondary)',
                }}
              >
                {/* Grade and score are capped — they come from a Lighthouse run on the
                    scanned (attacker-chosen) site, even though they are numeric. */}
                {capString(desktop.grade)} ({desktop.score})
              </span>
            )}
          </div>
          {/* Disclaimer — plain i18n string, no escaping needed */}
          <p
            data-testid="desktop-subordinate-note"
            style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 16px', fontStyle: 'italic' }}
          >
            {t('performance.desktopSubordinateNote')}
          </p>
          {/* Desktop Core Web Vitals — same component, no fieldData (desktop has no CrUX) */}
          <CoreWebVitals metrics={desktop.metrics} />
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 32 }} />

      {/* AI Improvement Suggestions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ marginBottom: 8 }}>Loading AI-powered suggestions...</div>
          <div style={{
            width: 40,
            height: 40,
            margin: '0 auto',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      ) : error ? (
        <div style={{
          backgroundColor: '#ef444433',
          borderRadius: 12,
          padding: 20,
          border: '1px solid #ef444444',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
            Failed to load AI suggestions
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {error}
          </div>
        </div>
      ) : suggestions ? (
        <AIImprovementSuggestions
          scanId={scanId}
          quickWins={suggestions.quickWins}
          majorImprovements={suggestions.majorImprovements}
          aiPromptBundle={suggestions.aiPromptBundle}
        />
      ) : null}
    </div>
  );
}
