'use client';

import { AccessibilityGrade } from './accessibility-grade';
import { WCAGCompliance } from './wcag-compliance';
import type { Finding } from '@/types';

/**
 * AccessibilitySection Component
 * Main container for accessibility metrics and WCAG 2.2 compliance
 */

interface AccessibilityData {
  accessibilityGrade: string;
  accessibilityScore: number;
  accessibilityMetrics: {
    violations: unknown[];
  };
}

interface AccessibilitySectionProps {
  accessibilityData: AccessibilityData;
  findings: Finding[];
}

export function AccessibilitySection({ accessibilityData, findings }: AccessibilitySectionProps) {
  // Filter accessibility findings (P3-xx modules)
  const accessibilityFindings = findings.filter(f => f.module.startsWith('P3-'));

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      padding: 32,
      marginBottom: 28,
    }}>
      {/* Header with Accessibility Grade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        <AccessibilityGrade
          grade={accessibilityData.accessibilityGrade}
          score={accessibilityData.accessibilityScore}
          size={120}
        />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Accessibility Analysis
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {accessibilityData.accessibilityScore >= 95
              ? 'Excellent accessibility! Your site meets WCAG 2.2 Level AA standards and is usable by people with disabilities.'
              : accessibilityData.accessibilityScore >= 85
              ? 'Good accessibility with minor issues. A few improvements will ensure full WCAG 2.2 Level AA compliance.'
              : accessibilityData.accessibilityScore >= 70
              ? 'Fair accessibility, but some violations exist. Address these to improve usability for people with disabilities.'
              : accessibilityData.accessibilityScore >= 50
              ? 'Accessibility needs attention. Significant barriers exist for users with disabilities.'
              : 'Critical accessibility issues detected. Your site may violate ADA/Section 508 requirements.'}
          </p>
        </div>
      </div>

      {/* WCAG Compliance */}
      <div style={{ marginBottom: 32 }}>
        <WCAGCompliance
          score={accessibilityData.accessibilityScore}
          violationsCount={accessibilityFindings.length}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--border)', marginBottom: 32 }} />

      {/* Accessibility Findings */}
      <div>
        <h3 style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}>
          WCAG 2.2 Violations
        </h3>

        {accessibilityFindings.length === 0 ? (
          <div style={{
            backgroundColor: '#10b98133',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #10b98144',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
              No Accessibility Issues Detected
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Your site meets WCAG 2.2 Level AA automated checks.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Group findings by category */}
            {['Color & Contrast', 'Keyboard Navigation', 'Screen Reader Support', 'Semantic HTML', 'Forms & Interactive'].map((category, idx) => {
              const categoryFindings = accessibilityFindings.filter(f => {
                if (idx === 0) return f.module === 'P3-01';
                if (idx === 1) return f.module === 'P3-02';
                if (idx === 2) return f.module === 'P3-03';
                if (idx === 3) return f.module === 'P3-04';
                if (idx === 4) return f.module === 'P3-05';
                return false;
              });

              if (categoryFindings.length === 0) return null;

              return (
                <div key={category} style={{
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 12,
                  padding: 16,
                  border: '1px solid var(--border)',
                }}>
                  <h4 style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: 12,
                  }}>
                    {category} ({categoryFindings.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {categoryFindings.map((finding, i) => (
                      <div key={i} style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        paddingLeft: 12,
                        borderLeft: '3px solid var(--accent)',
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          {finding.title}
                        </div>
                        <div>{finding.evidence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
