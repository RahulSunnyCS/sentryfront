'use client';

import { useState, useEffect } from 'react';
import { PerformanceGrade } from './performance-grade';
import { CoreWebVitals } from './core-web-vitals';
import { AIImprovementSuggestions } from './ai-improvement-suggestions';

/**
 * PerformanceSection Component
 * Main container for performance metrics and AI suggestions
 */

interface PerformanceData {
  performanceGrade: string;
  performanceScore: number;
  performanceMetrics: {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    ttfb: number | null;
  };
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

export function PerformanceSection({ scanId, performanceData }: PerformanceSectionProps) {
  const [suggestions, setSuggestions] = useState<PerformanceSuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [scanId]);

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      padding: 32,
      marginBottom: 28,
    }}>
      {/* Header with Performance Grade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        <PerformanceGrade
          grade={performanceData.performanceGrade}
          score={performanceData.performanceScore}
          size={120}
        />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
            Performance Analysis
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {performanceData.performanceScore >= 90 
              ? 'Excellent performance! Your site loads fast and provides a great user experience.'
              : performanceData.performanceScore >= 75
              ? 'Good performance, but there\'s room for improvement. Focus on Core Web Vitals.'
              : performanceData.performanceScore >= 50
              ? 'Moderate performance. Addressing key issues will significantly improve user experience.'
              : 'Performance needs attention. Prioritize critical issues for maximum impact.'}
          </p>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div style={{ marginBottom: 32 }}>
        <CoreWebVitals metrics={performanceData.performanceMetrics} />
      </div>

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
