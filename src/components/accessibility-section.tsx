'use client';

import { AccessibilityGrade } from './accessibility-grade';
import { WCAGCompliance } from './wcag-compliance';

interface AccessibilityData {
  accessibilityGrade: string;
  accessibilityScore: number;
  accessibilityMetrics: {
    violations: unknown[];
  };
}

interface AccessibilitySectionProps {
  accessibilityData: AccessibilityData;
}

export function AccessibilitySection({ accessibilityData }: AccessibilitySectionProps) {
  const violationsCount = accessibilityData.accessibilityMetrics.violations.length;

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      padding: 32,
      marginBottom: 28,
    }}>
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
              ? 'Excellent accessibility! Your site is usable by people with a wide range of abilities.'
              : accessibilityData.accessibilityScore >= 85
              ? 'Good accessibility with minor issues. A few improvements will broaden the audience your site reaches.'
              : accessibilityData.accessibilityScore >= 70
              ? 'Fair accessibility, but some violations exist. Address these to improve usability for people with disabilities.'
              : accessibilityData.accessibilityScore >= 50
              ? 'Accessibility needs attention. Significant barriers exist for users with disabilities.'
              : 'Critical accessibility issues detected. Many users will struggle to use this site.'}
          </p>
        </div>
      </div>

      <WCAGCompliance
        score={accessibilityData.accessibilityScore}
        violationsCount={violationsCount}
      />
    </div>
  );
}
