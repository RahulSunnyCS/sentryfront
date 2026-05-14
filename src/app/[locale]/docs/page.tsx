import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { DocsLayout } from './docs-layout';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'VibeSafe documentation — quick start, active testing, API reference, webhooks, CI/CD integration, fix prompts, and FAQ. Everything you need to ship a secure AI-built site.',
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'VibeSafe documentation',
    description:
      'Quick start, active testing, API reference, webhooks, CI/CD integration, and more.',
    url: '/docs',
    type: 'article',
  },
};

export default function DocsPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <DocsLayout />
        <Footer />
      </div>
    </>
  );
}
