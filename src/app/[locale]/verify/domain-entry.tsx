'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

interface Props {
  initialDomain: string;
  error: string | null;
}

export function DomainEntry({ initialDomain, error }: Props) {
  const t = useTranslations('verify');
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
        {t('askDomainTitle')}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
        {t('askDomainHint')}
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
            {t('domainLabel')}
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
            placeholder={t('domainPlaceholder')}
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
          {submitting ? t('loadingBtn') : t('continueBtn')}
        </button>
      </form>
    </section>
  );
}
