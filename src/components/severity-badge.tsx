import { SEVERITY_CONFIG } from '@/lib/data';
import type { Severity } from '@/types';

interface Props {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { fontSize: 10, padding: '2px 6px', fontWeight: 600 },
  md: { fontSize: 11, padding: '3px 8px', fontWeight: 700 },
  lg: { fontSize: 12, padding: '4px 10px', fontWeight: 700 },
} as const;

export function SeverityBadge({ severity, size = 'md' }: Props) {
  const config = SEVERITY_CONFIG[severity];
  const s = sizes[size];
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        padding: s.padding,
        borderRadius: 4,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {severity}
    </span>
  );
}
