import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrNotFound } from '@/lib/auth/helpers';

export const metadata: Metadata = {
  title: 'Internal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/internal/fp-rates', label: 'FP rates' },
  { href: '/internal/features', label: 'Feature flags' },
  { href: '/internal/users', label: 'Users' },
  { href: '/internal/dispositions', label: 'Dispositions' },
  { href: '/internal/cron', label: 'Cron' },
];

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminOrNotFound();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/internal/fp-rates" className="font-semibold tracking-tight">
            VibeSafe · Internal
          </Link>
          <nav className="flex gap-3 text-sm text-white/70">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="text-xs text-white/50">{admin.email}</div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
