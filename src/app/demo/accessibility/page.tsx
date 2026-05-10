/**
 * Accessibility Demo Page
 * Showcases the accessibility scanning UI with realistic mock WCAG violations
 */

import { AccessibilityGrade } from '@/components/accessibility-grade';
import { WCAGCompliance } from '@/components/wcag-compliance';
import { generateMockAccessibilityMetrics, generateMockAccessibilityFindings } from '@/lib/mock/accessibility-data';

export const metadata = {
  title: 'Accessibility Demo | VibeSafe',
  description: 'Demo of WCAG 2.2 Level AA accessibility scanning',
};

export default function AccessibilityDemoPage() {
  const metrics = generateMockAccessibilityMetrics();
  const findings = generateMockAccessibilityFindings();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          marginBottom: 32,
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 12px',
            backgroundColor: '#3b82f633',
            color: '#3b82f6',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Demo Page
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: 12,
          }}>
            Accessibility Scanning Demo
          </h1>
          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: 560,
            margin: '0 auto',
          }}>
            VibeSafe now checks for <strong>WCAG 2.2 Level AA compliance</strong> using Lighthouse accessibility audits.
            This demo shows what accessibility violations look like in your reports.
          </p>
        </div>

        {/* Main Demo Section */}
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          padding: 32,
          marginBottom: 28,
        }}>
          {/* Header with Accessibility Grade */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginBottom: 32,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <AccessibilityGrade
              grade={metrics.accessibilityGrade}
              score={metrics.accessibilityScore}
              size={120}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{
                fontSize: 24,
                fontWeight: 800,
                color: 'var(--text)',
                marginBottom: 8,
              }}>
                Accessibility Analysis
              </h2>
              <p style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Fair accessibility, but some violations exist. Address these to improve usability for people with disabilities.
              </p>
            </div>
          </div>

          {/* WCAG Compliance */}
          <div style={{ marginBottom: 32 }}>
            <WCAGCompliance
              score={metrics.accessibilityScore}
              violationsCount={findings.length}
            />
          </div>

          {/* Divider */}
          <div style={{
            height: 1,
            backgroundColor: 'var(--border)',
            marginBottom: 32,
          }} />

          {/* Accessibility Violations */}
          <div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 16,
            }}>
              WCAG 2.2 Violations
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {findings.map((finding, idx) => (
                <div key={idx} style={{
                  backgroundColor: 'var(--surface-secondary)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}>
                  {/* Module badge */}
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    backgroundColor: finding.severity === 'HIGH' ? '#ef444433' : '#f59e0b33',
                    color: finding.severity === 'HIGH' ? '#ef4444' : '#f59e0b',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 12,
                  }}>
                    {finding.severity}
                  </div>

                  {/* Title */}
                  <h4 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}>
                    {finding.title}
                  </h4>

                  {/* Location */}
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    marginBottom: 12,
                  }}>
                    📍 {finding.location}
                  </div>

                  {/* Evidence */}
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: 12,
                    paddingLeft: 12,
                    borderLeft: '3px solid var(--accent)',
                  }}>
                    {finding.evidence}
                  </div>

                  {/* Explanation */}
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}>
                    {finding.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div style={{
          backgroundColor: '#3b82f611',
          border: '1px solid #3b82f633',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            💡 <strong>This is demo data.</strong> Run a real scan with{' '}
            <code style={{
              backgroundColor: 'var(--surface-secondary)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 13,
            }}>
              ACCESSIBILITY_SCANNING_ENABLED=true
            </code>{' '}
            to see actual WCAG violations on your website.
          </div>
        </div>
      </div>
    </div>
  );
}
