'use client';

import { useState } from 'react';
import { IconCheck, IconCopy } from './icons';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
        background: copied ? 'var(--accent)' : 'var(--surface)', cursor: 'pointer',
        fontSize: 13, fontWeight: 500, color: copied ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s',
      }}
    >
      {copied ? <IconCheck size={14} color="#fff" /> : <IconCopy size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
