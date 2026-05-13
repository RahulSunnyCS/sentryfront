import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { LandingHero } from './landing-hero';

export const metadata: Metadata = {
  title: 'VibeSafe — Security, performance & compliance scanner for AI-built sites',
  description:
    'Paste a URL and get an enterprise-grade security, performance, accessibility, and SEO report in 90 seconds. Every finding ships with a ready-to-paste AI fix prompt for Cursor, Lovable, Bolt, v0, and Replit.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'VibeSafe — Security, performance & compliance scanner for AI-built sites',
    description:
      'Scan any URL in 90 seconds. Security, compliance, performance, accessibility, and SEO — all with AI fix prompts you can paste into Cursor or Lovable.',
    url: '/',
    type: 'website',
  },
};

export default function HomePage() {
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
        Skip to content
      </a>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <LandingHero />
        <Footer />
      </div>
    </>
  );
}
