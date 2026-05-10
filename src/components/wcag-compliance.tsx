'use client';

/**
 * WCAGCompliance Component
 * Displays WCAG 2.2 Level AA compliance badge and breakdown
 */

interface WCAGComplianceProps {
  score: number; // 0-100
  violationsCount: number;
}

export function WCAGCompliance({ score, violationsCount }: WCAGComplianceProps) {
  // Determine compliance level based on score
  const getComplianceLevel = (s: number) => {
    if (s >= 95) return { level: 'Full Compliance', color: '#10b981', emoji: '✅' };
    if (s >= 85) return { level: 'Minor Issues', color: '#3b82f6', emoji: '✔️' };
    if (s >= 70) return { level: 'Some Violations', color: '#f59e0b', emoji: '⚠️' };
    if (s >= 50) return { level: 'Significant Issues', color: '#ef4444', emoji: '❌' };
    return { level: 'Critical Barriers', color: '#991b1b', emoji: '🚫' };
  };

  const compliance = getComplianceLevel(score);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16,
    }}>
      {/* WCAG 2.2 Badge */}
      <div style={{
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-tertiary)',
        }}>
          Standard
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--text)',
        }}>
          WCAG 2.2 Level AA
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          Web Content Accessibility Guidelines
        </div>
      </div>

      {/* Compliance Status */}
      <div style={{
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-tertiary)',
        }}>
          Status
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          color: compliance.color,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{compliance.emoji}</span>
          <span>{compliance.level}</span>
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          {violationsCount} violation{violationsCount !== 1 ? 's' : ''} detected
        </div>
      </div>

      {/* Compliance Percentage */}
      <div style={{
        backgroundColor: 'var(--surface-secondary)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--text-tertiary)',
        }}>
          Lighthouse Score
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          color: 'var(--text)',
        }}>
          {score}%
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          Automated audit score
        </div>
      </div>
    </div>
  );
}
