/**
 * Performance Suggestions Demo Page
 *
 * Showcases file-specific performance suggestions with realistic mock data.
 * This demonstrates how the new audit parser provides actionable, file-level insights.
 */

import { PerformanceGrade } from '@/components/performance-grade';
import { CoreWebVitals } from '@/components/core-web-vitals';
import { AIImprovementSuggestions } from '@/components/ai-improvement-suggestions';
import { generateMockPerformanceMetrics, generateMockFindings } from '@/lib/mock/performance-data';
import { generateImprovementPlan } from '@/lib/scanner/performance-suggestions';

export default function PerformanceDemoPage() {
  // Generate mock data
  const metrics = generateMockPerformanceMetrics();
  const findings = generateMockFindings();

  // Generate improvement plan
  const plan = generateImprovementPlan(
    findings,
    metrics,
    'D', // Performance grade
    42   // Performance score
  );
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--background)',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: 40,
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#3b82f633',
            color: '#3b82f6',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 16,
          }}>
            🎭 Demo Mode
          </div>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 12,
          }}>
            File-Specific Performance Suggestions
          </h1>
          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            See how VibeSafe now provides <strong>specific file URLs</strong> and{' '}
            <strong>exact savings</strong> instead of generic advice.
          </p>
        </div>
        
        {/* Before/After Comparison */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          marginBottom: 48,
        }}>
          <div style={{
            backgroundColor: 'var(--surface-secondary)',
            borderRadius: 12,
            padding: 24,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12,
            }}>
              ❌ Before (Generic)
            </div>
            <div style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--border)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              &quot;You have unused JavaScript. Consider code splitting.&quot;
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--surface-secondary)',
            borderRadius: 12,
            padding: 24,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#10b981',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12,
            }}>
              ✅ After (File-Specific)
            </div>
            <div style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--border)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              color: 'var(--text)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {`I have unused JavaScript (total: 547 KiB) in these files:

1. recaptcha/api.js (202 KiB wasted, 84% unused)
   URL: https://www.google.com/recaptcha/...
2. main.chunk.js (142 KiB wasted, 77% unused)
   URL: https://example.com/static/js/...
3. lodash.min.js (67 KiB wasted, 96% unused)
   URL: https://cdn.jsdelivr.net/...

Help me:
1. Implement code splitting
2. Remove unused dependencies
3. Use dynamic imports
4. Enable tree-shaking`}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 24,
          }}>
            Performance Overview
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 24,
            marginBottom: 32,
          }}>
            <PerformanceGrade grade="D" score={42} />
            <CoreWebVitals
              metrics={{
                lcp: metrics.lcp,
                fcp: metrics.fcp,
                cls: metrics.cls,
                tbt: metrics.tbt,
                ttfb: metrics.ttfb,
              }}
            />
          </div>

          <AIImprovementSuggestions
            scanId="demo"
            quickWins={plan.quickWins}
            majorImprovements={plan.majorImprovements}
            aiPromptBundle={plan.aiPromptBundle}
          />
        </div>
        
        {/* Footer Note */}
        <div style={{
          marginTop: 48,
          padding: 24,
          backgroundColor: '#3b82f611',
          borderRadius: 12,
          border: '1px solid #3b82f633',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            💡 This demo uses mock data to showcase the new file-specific suggestions feature.
            <br />
            Run a real scan to see actual performance insights for your website.
          </div>
        </div>
      </div>
    </div>
  );
}
