'use client';

import { useEffect, useState } from 'react';
import { GRADE_CONFIG } from '@/lib/data';
import type { Grade, GradeStyle } from '@/types';

interface Props {
  grade: Grade;
  size?: number;
  style?: GradeStyle;
  animated?: boolean;
}

export function GradeDisplay({ grade, size = 140, style = 'ring', animated = true }: Props) {
  if (style === 'shield') return <GradeShield grade={grade} size={size} />;
  if (style === 'letter') return <GradeLetter grade={grade} size={size} />;
  return <GradeRing grade={grade} size={size} animated={animated} />;
}

function GradeRing({ grade, size, animated }: { grade: Grade; size: number; animated: boolean }) {
  const config = GRADE_CONFIG[grade];
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(animated ? circ : circ * (1 - config.fill));

  useEffect(() => {
    if (!animated) return;
    const t = setTimeout(() => setOffset(circ * (1 - config.fill)), 100);
    return () => clearTimeout(t);
  }, [grade, animated, circ, config.fill]);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" opacity="0.5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={config.color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: animated ? 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' : 'none' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.36, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: size * 0.09, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
      </div>
    </div>
  );
}

function GradeShield({ grade, size }: { grade: Grade; size: number }) {
  const config = GRADE_CONFIG[grade];
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.75} height={size * 0.88} viewBox="0 0 60 70" fill="none">
        <path d="M30 2L56 16v20c0 18-11 28-26 32C15 64 4 54 4 36V16L30 2z" fill={config.color} opacity="0.1" stroke={config.color} strokeWidth="2" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
        <span style={{ fontSize: size * 0.32, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: size * 0.085, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
      </div>
    </div>
  );
}

function GradeLetter({ grade, size }: { grade: Grade; size: number }) {
  const config = GRADE_CONFIG[grade];
  return (
    <div style={{
      width: size, height: size, borderRadius: size, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: config.bg, border: `3px solid ${config.color}`,
    }}>
      <span style={{ fontSize: size * 0.42, fontWeight: 800, color: config.color, lineHeight: 1 }}>{grade}</span>
      <span style={{ fontSize: size * 0.09, fontWeight: 600, color: config.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{config.label}</span>
    </div>
  );
}
