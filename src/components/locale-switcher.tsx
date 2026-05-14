'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Locale;
    startTransition(() => {
      // Preserves the current dynamic params (e.g. /report/[id])
      router.replace(
        // @ts-expect-error -- pathname signature changes per route, but next-intl handles it
        { pathname, params },
        { locale: next }
      );
    });
  };

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        position: 'relative',
      }}
    >
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={onChange}
        disabled={isPending}
        aria-label={t('label')}
        style={{
          appearance: 'none',
          padding: '6px 24px 6px 10px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 8,
          pointerEvents: 'none',
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}
      >
        ▾
      </span>
    </label>
  );
}
