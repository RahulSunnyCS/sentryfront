'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  initialDomain: string;
  error: string | null;
}

export function DomainEntry({ initialDomain, error }: Props) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim();
    if (!trimmed) return;
    setSubmitting(true);
    router.push(`/verify?domain=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section
      style={{
        maxWidth: 520,
        margin: '0 auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-8) var(--space-6)',
      }}
    >
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
        Which domain are you verifying?
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        Enter the bare domain — no <code>https://</code>, no path.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <label
            htmlFor="domain-input"
            style={{
              display: 'block',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              marginBottom: 'var(--space-2)',
            }}
          >
            Domain
          </label>
          <input
            id="domain-input"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="field"
            disabled={submitting}
          />
        </div>

        {error && (
          <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#E11D48', margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || !domain.trim()}
          style={{ justifyContent: 'center' }}
        >
          {submitting ? 'Loading…' : 'Continue'}
        </button>
      </form>
    </section>
  );
}
