'use client';

import { useState } from 'react';
import { CopyButton } from './copy-button';

/**
 * AIImprovementSuggestions Component
 * Displays performance improvement suggestions with AI prompts
 */

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

interface AIImprovementSuggestionsProps {
  scanId: string;
  quickWins: ImprovementSuggestion[];
  majorImprovements: ImprovementSuggestion[];
  aiPromptBundle: string;
}

const PRIORITY_COLORS = {
  CRITICAL: { bg: '#991b1b33', text: '#991b1b', label: 'Critical' },
  HIGH: { bg: '#ef444433', text: '#ef4444', label: 'High' },
  MEDIUM: { bg: '#f59e0b33', text: '#f59e0b', label: 'Medium' },
  LOW: { bg: '#3b82f633', text: '#3b82f6', label: 'Low' },
};

function SuggestionCard({ suggestion }: { suggestion: ImprovementSuggestion }) {
  const [expanded, setExpanded] = useState(false);
  const colors = PRIORITY_COLORS[suggestion.priority];
  
  return (
    <div style={{
      backgroundColor: 'var(--surface-secondary)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      padding: 16,
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
    onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{
          padding: '4px 8px',
          backgroundColor: colors.bg,
          color: colors.text,
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {colors.label}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {suggestion.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {suggestion.description}
          </div>
        </div>
      </div>
      
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Impact: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{suggestion.estimatedImpact}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Effort: </span>
              <span style={{ color: 'var(--text-secondary)' }}>{suggestion.estimatedEffort}</span>
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 8,
            padding: 12,
            border: '1px solid var(--border)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AI Prompt
              </span>
              <CopyButton
                text={suggestion.aiPrompt}
                label="Copy AI Prompt"
              />
            </div>
            <pre style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
              fontFamily: 'ui-monospace, monospace',
            }}>
              {suggestion.aiPrompt}
            </pre>
          </div>
        </div>
      )}
      
      <div style={{
        marginTop: 8,
        fontSize: 12,
        color: 'var(--text-tertiary)',
        fontWeight: 500,
      }}>
        {expanded ? '▲ Click to collapse' : '▼ Click to expand and see AI prompt'}
      </div>
    </div>
  );
}

export function AIImprovementSuggestions({
  quickWins,
  majorImprovements,
  aiPromptBundle,
}: AIImprovementSuggestionsProps) {
  const [showAllPrompt, setShowAllPrompt] = useState(false);
  
  const allSuggestions = [...quickWins, ...majorImprovements];
  
  if (allSuggestions.length === 0) {
    return (
      <div style={{
        backgroundColor: '#10b98133',
        borderRadius: 12,
        padding: 20,
        border: '1px solid #10b98144',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
          Excellent Performance!
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          No significant performance improvements needed.
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          AI-Powered Improvement Suggestions
        </h3>
        <button
          onClick={() => setShowAllPrompt(!showAllPrompt)}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showAllPrompt ? 'Hide' : 'Show'} Complete AI Prompt
        </button>
      </div>
      
      {showAllPrompt && (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 12,
          padding: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Complete AI Prompt Bundle
            </span>
            <CopyButton text={aiPromptBundle} label="Copy Complete Prompt" />
          </div>
          <pre style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            fontFamily: 'ui-monospace, monospace',
            maxHeight: 400,
            overflow: 'auto',
          }}>
            {aiPromptBundle}
          </pre>
        </div>
      )}

      {quickWins.length > 0 && (
        <div>
          <h4 style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>⚡</span>
            <span>Quick Wins</span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--surface-secondary)',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              High impact, low effort (&lt;1 hour)
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quickWins.map((suggestion, i) => (
              <SuggestionCard key={i} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}

      {majorImprovements.length > 0 && (
        <div>
          <h4 style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>🎯</span>
            <span>Major Improvements</span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--surface-secondary)',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              High impact, medium effort
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {majorImprovements.map((suggestion, i) => (
              <SuggestionCard key={i} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
