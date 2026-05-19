/**
 * Tests for T-20 — LocaleSwitcher / ThemeToggle placement.
 *
 * Behaviour under test:
 *  - nav.tsx <NavPreferences>: renders the LocaleSwitcher + ThemeToggle ONLY
 *    when signed-out (auth disabled, or session not authenticated, or the
 *    transient 'loading' state). It returns null — switchers hidden — when
 *    the auth feature is on AND a session is authenticated.
 *  - auth-button.tsx <AuthButton> user menu: when authenticated, the menu
 *    contains the REAL LocaleSwitcher / ThemeToggle (replacing the former
 *    fake PreferenceRows) and Sign out still calls next-auth signOut().
 *
 * The global vitest.setup.ts mocks next-auth/react with a fixed
 * unauthenticated session; we override it locally so each test can drive
 * status/data. next-intl is stubbed the same way the existing component
 * tests do (core-web-vitals.test.tsx / performance-section.test.tsx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockUseSession, mockSignOut, mockUseFeature } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockUseFeature: vi.fn(),
}));

// Local override of the global next-auth/react setup mock.
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: mockSignOut,
  signIn: vi.fn(),
}));

vi.mock('@/lib/client-features', () => ({
  useFeature: (f: string) => mockUseFeature(f),
}));

// Stub next-intl exactly like the existing component tests do.
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'en',
}));

// next-intl navigation Link / hooks → simple stubs.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'hi', 'ml', 'es', 'de'], defaultLocale: 'en' },
}));

// Keep the Nav lean: stub the unrelated heavy children so the test focuses
// on NavPreferences. AuthButton, LocaleSwitcher, ThemeToggle are NOT stubbed
// (they are the subject / its single-source-of-truth siblings).
vi.mock('@/components/pdf-export-button', () => ({ PdfExportButton: () => null }));
vi.mock('@/components/verify-email-nudge', () => ({ VerifyEmailNudge: () => null }));
vi.mock('@/components/logo', () => ({ Logo: () => null }));
vi.mock('@/components/icons', () => ({ IconExternalLink: () => null }));

import { Nav } from '@/components/nav';
import { AuthButton } from '@/components/auth-button';

const LOCALE_TESTID = 'locale-switcher';
const THEME_TESTID = 'theme-toggle';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFeature.mockReturnValue(true); // auth feature enabled by default
  // CreditsChip (an unrelated nav child) fetches /api/v1/me/credits when
  // authenticated; stub fetch so its effect resolves harmlessly.
  (global.fetch as unknown as ReturnType<typeof vi.fn>) = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => null });
});

// ── Nav <NavPreferences> ─────────────────────────────────────────────────────

describe('Nav — NavPreferences switcher placement', () => {
  it('shows LocaleSwitcher + ThemeToggle when signed out (unauthenticated session)', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(<Nav />);

    // Signed-out: the switchers render in TWO placements by design — the
    // desktop nav bar (hidden ≤880px via CSS) and the mobile slide-out menu
    // (hidden ≥881px via CSS). Exactly one is visible per viewport; in jsdom
    // both are in the DOM regardless of CSS, so the count is 2.
    expect(screen.getAllByTestId(LOCALE_TESTID)).toHaveLength(2);
    expect(screen.getAllByTestId(THEME_TESTID)).toHaveLength(2);
  });

  it('shows the switchers during the transient loading session state', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<Nav />);

    expect(screen.getAllByTestId(LOCALE_TESTID)).toHaveLength(2);
    expect(screen.getAllByTestId(THEME_TESTID)).toHaveLength(2);
  });

  it('shows the switchers when the auth feature is disabled (even if a session exists)', () => {
    mockUseFeature.mockReturnValue(false); // auth feature off
    mockUseSession.mockReturnValue({
      data: { user: { email: 'a@x.com' } },
      status: 'authenticated',
    });

    render(<Nav />);

    expect(screen.getAllByTestId(LOCALE_TESTID)).toHaveLength(2);
    expect(screen.getAllByTestId(THEME_TESTID)).toHaveLength(2);
  });

  it('hides the desktop-bar switchers when signed in but keeps them in the mobile menu', () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: 'a@x.com', name: 'Ada Lovelace' } },
      status: 'authenticated',
    });

    render(<Nav />);

    // Signed in: the desktop-bar <NavPreferences/> returns null, but the
    // mobile slide-out menu ALWAYS exposes locale/theme at its top level
    // (so an authorised user can change them from the first menu screen
    // rather than drilling into the nested account dropdown). So exactly
    // ONE instance is in the DOM — the mobile-menu copy.
    expect(screen.getAllByTestId(LOCALE_TESTID)).toHaveLength(1);
    expect(screen.getAllByTestId(THEME_TESTID)).toHaveLength(1);
  });
});

// ── AuthButton user menu ─────────────────────────────────────────────────────

describe('AuthButton — signed-in user menu', () => {
  it('renders the Sign in link when no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(<AuthButton />);

    expect(screen.getByRole('link', { name: 'auth.signIn' })).toBeInTheDocument();
    expect(screen.queryByTestId(LOCALE_TESTID)).not.toBeInTheDocument();
  });

  it('renders a session-validating spinner during loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    render(<AuthButton />);

    expect(screen.getByRole('status', { name: 'Validating session' })).toBeInTheDocument();
  });

  it('opens the user menu and exposes the REAL LocaleSwitcher + ThemeToggle', () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: 'ada@x.com', name: 'Ada Lovelace' } },
      status: 'authenticated',
    });

    render(<AuthButton />);

    // Closed menu → switchers not yet mounted.
    expect(screen.queryByTestId(LOCALE_TESTID)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'auth.accountMenu' }));

    // The real components (not fake PreferenceRows) are now in the portal.
    expect(screen.getByTestId(LOCALE_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(THEME_TESTID)).toBeInTheDocument();
  });

  it('Sign out still calls next-auth signOut() from the menu', () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: 'ada@x.com', name: 'Ada Lovelace' } },
      status: 'authenticated',
    });

    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button', { name: 'auth.accountMenu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'auth.signOut' }));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
