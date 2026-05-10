'use client';

/**
 * PerformanceGrade Component
 * Displays performance grade (A-F) with color coding and Lighthouse score
 */

interface PerformanceGradeProps {
  grade: string;
  score: number; // 0-100
  size?: number;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: '#10b981', text: '#fff', ring: '#34d399' },
  B: { bg: '#3b82f6', text: '#fff', ring: '#60a5fa' },
  C: { bg: '#f59e0b', text: '#fff', ring: '#fbbf24' },
  D: { bg: '#ef4444', text: '#fff', ring: '#f87171' },
  F: { bg: '#991b1b', text: '#fff', ring: '#dc2626' },
};

export function PerformanceGrade({ grade, score, size = 120 }: PerformanceGradeProps) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.F;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Grade Circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: colors.bg,
          color: colors.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 4px ${colors.ring}33, 0 4px 12px rgba(0,0,0,0.15)`,
          fontWeight: 900,
          fontSize: size * 0.4,
          lineHeight: 1,
          position: 'relative',
        }}
      >
        {grade}
        <div style={{
          fontSize: size * 0.15,
          fontWeight: 600,
          marginTop: size * 0.05,
          opacity: 0.9,
        }}>
          {score}/100
        </div>
      </div>
      
      {/* Label */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Performance
      </div>
    </div>
  );
}
