'use client';

import { useTranslations } from 'next-intl';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { LandingHero } from './landing-hero';

export default function HomePage() {
  const t = useTranslations('common');
  return (
    <>
      <a
        href="#main"
        style={{
          position: 'absolute',
          left: -9999,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
        onFocus={(e) => {
          const el = e.currentTarget;
          el.style.left = '16px';
          el.style.top = '16px';
          el.style.width = 'auto';
          el.style.height = 'auto';
          el.style.padding = '10px 14px';
          el.style.background = 'var(--accent)';
          el.style.color = '#fff';
          el.style.zIndex = '9999';
          el.style.borderRadius = '8px';
          el.style.fontWeight = '600';
        }}
        onBlur={(e) => {
          const el = e.currentTarget;
          el.style.left = '-9999px';
          el.style.top = 'auto';
          el.style.width = '1px';
          el.style.height = '1px';
        }}
      >
        {t('skipToContent')}
      </a>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <LandingHero />
        <Footer />
      </div>
    </>
  );
}
