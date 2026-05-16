/**
 * Unit tests for src/lib/auth/helpers.ts
 *
 * getServerSession and the features module are mocked here so we can control
 * the session/config without real OAuth or a live database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Module mocks (declared before any imports of the module under test) ───────

// vi.mock factories are hoisted to the top of the file by Vitest, so variables
// declared in the test file body are not yet initialised when the factory runs.
// We use vi.hoisted() to create the mock function in the hoisted scope so it is
// available both inside the factory and in the test body.
const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

// authConfig.provider is read at call-time inside helpers.ts via the imported
// reference, so we expose a mutable object and swap its fields per test.
const mockAuthConfig = { provider: 'nextauth' as 'nextauth' | 'supabase' };
const mockIsFeatureReady = vi.fn();

vi.mock('@/lib/features', () => ({
  get authConfig() {
    return mockAuthConfig;
  },
  isFeatureReady: mockIsFeatureReady,
}));

// next/navigation.notFound is already mocked by vitest.setup.ts but we need
// to spy on it to assert it was called.
const mockNotFound = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// next/server NextResponse.json must return a shape the caller can inspect.
const mockNextResponseJson = vi.fn((_body: unknown, init?: { status?: number }) => ({
  status: init?.status ?? 200,
}));
vi.mock('next/server', () => ({
  NextResponse: {
    json: mockNextResponseJson,
  },
}));

// nextauth-config re-exports from features which we already mocked; the import
// itself only needs to resolve — its value is opaque to helpers.ts callers.
vi.mock('@/lib/auth/nextauth-config', () => ({
  nextAuthConfig: {},
}));

// ── Import after mocks are wired ─────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import {
  getCurrentUser,
  requireAuth,
  hasTier,
  getUserTier,
  isAdminUser,
  requireAdminOrNotFound,
  assertAdminApi,
  isAuthEnabled,
  getAuthProvider,
} from '@/lib/auth/helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

function makeDbUser(overrides: Partial<{ id: string; email: string; tier: string }> = {}) {
  return { id: 'user-1', email: 'user@example.com', tier: 'free', ...overrides };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCurrentUser()', () => {
  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('returns null when auth feature is not ready', async () => {
    mockIsFeatureReady.mockReturnValue(false);
    const result = await getCurrentUser();
    expect(result).toBeNull();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it('returns null when session has no user email', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    mockGetServerSession.mockResolvedValue({ user: {} }); // no email
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when session is missing entirely', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    mockGetServerSession.mockResolvedValue(null);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when user is not found in the database', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    mockGetServerSession.mockResolvedValue({ user: { email: 'ghost@example.com' } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns the AuthUser and sets Sentry user when session and DB record exist', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser();
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    const result = await getCurrentUser();

    expect(result).toEqual({ id: 'user-1', email: 'user@example.com', tier: 'free' });
    // Sentry.setUser is mocked in vitest.setup.ts — just confirm no throw
  });

  it('returns null for supabase provider (stub path)', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'supabase';
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when db user has no email field', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    mockGetServerSession.mockResolvedValue({ user: { email: 'x@x.com' } });
    // Simulate a record where email is null (shouldn't happen but defensive path exists)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', email: null, tier: 'free' } as any);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });
});

// ── requireAuth ───────────────────────────────────────────────────────────────

describe('requireAuth()', () => {
  it('returns user when authenticated', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser();
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    await expect(requireAuth()).resolves.toEqual(dbUser);
  });

  it('throws "Authentication required" when not authenticated', async () => {
    mockIsFeatureReady.mockReturnValue(false); // auth disabled → getCurrentUser returns null
    await expect(requireAuth()).rejects.toThrow('Authentication required');
  });
});

// ── hasTier ───────────────────────────────────────────────────────────────────

describe('hasTier()', () => {
  it('returns false for null user', () => {
    expect(hasTier(null, 'free')).toBe(false);
  });

  it('returns true when user tier matches required tier exactly', () => {
    expect(hasTier(makeDbUser({ tier: 'free' }), 'free')).toBe(true);
  });

  it('returns false when free user requires a higher tier', () => {
    expect(hasTier(makeDbUser({ tier: 'free' }), 'pro')).toBe(false);
  });

  it('returns true when pro user requires one-shot (lower tier)', () => {
    expect(hasTier(makeDbUser({ tier: 'pro' }), 'one-shot')).toBe(true);
  });

  it('returns true when studio user requires any tier', () => {
    const studio = makeDbUser({ tier: 'studio' });
    expect(hasTier(studio, 'free')).toBe(true);
    expect(hasTier(studio, 'one-shot')).toBe(true);
    expect(hasTier(studio, 'pro')).toBe(true);
    expect(hasTier(studio, 'studio')).toBe(true);
  });

  it('returns false for an unknown tier (index -1)', () => {
    // indexOf returns -1 which is < any valid index, so always false
    expect(hasTier(makeDbUser({ tier: 'unknown' }), 'free')).toBe(false);
  });
});

// ── getUserTier ───────────────────────────────────────────────────────────────

describe('getUserTier()', () => {
  it('returns "free" when not authenticated', async () => {
    mockIsFeatureReady.mockReturnValue(false);
    await expect(getUserTier()).resolves.toBe('free');
  });

  it('returns user tier when authenticated', async () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser({ tier: 'pro' });
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);
    await expect(getUserTier()).resolves.toBe('pro');
  });
});

// ── isAdminUser ───────────────────────────────────────────────────────────────
// Detailed tests already live in is-admin.test.ts; these cover the interface.

describe('isAdminUser()', () => {
  afterEach(() => {
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('returns false for null user', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    expect(isAdminUser(null)).toBe(false);
  });

  it('returns true for matching admin email', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    expect(isAdminUser(makeDbUser({ email: 'admin@example.com' }))).toBe(true);
  });

  it('returns false when ADMIN_EMAILS is not set', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminUser(makeDbUser({ email: 'anyone@example.com' }))).toBe(false);
  });
});

// ── requireAdminOrNotFound ────────────────────────────────────────────────────

describe('requireAdminOrNotFound()', () => {
  afterEach(() => {
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('calls notFound() for a non-admin user', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser({ email: 'notadmin@example.com' });
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    // notFound() in Next.js throws internally; our mock just records the call.
    // The function continues after the mock (no throw), so we need to assert
    // that the mock was invoked.
    await requireAdminOrNotFound().catch(() => {});
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('returns user for an admin', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser({ email: 'admin@example.com' });
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    const result = await requireAdminOrNotFound();
    expect(result).toEqual(dbUser);
  });
});

// ── assertAdminApi ────────────────────────────────────────────────────────────

describe('assertAdminApi()', () => {
  afterEach(() => {
    if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  });

  it('returns ok:false with a 404 response for non-admins', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser({ email: 'user@example.com' });
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    const result = await assertAdminApi();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it('returns ok:true with user for admins', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    const dbUser = makeDbUser({ email: 'admin@example.com' });
    mockGetServerSession.mockResolvedValue({ user: { email: dbUser.email } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(dbUser as any);

    const result = await assertAdminApi();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.email).toBe('admin@example.com');
    }
  });
});

// ── isAuthEnabled / getAuthProvider ──────────────────────────────────────────

describe('isAuthEnabled()', () => {
  it('returns true when feature is ready', () => {
    mockIsFeatureReady.mockReturnValue(true);
    expect(isAuthEnabled()).toBe(true);
  });

  it('returns false when feature is not ready', () => {
    mockIsFeatureReady.mockReturnValue(false);
    expect(isAuthEnabled()).toBe(false);
  });
});

describe('getAuthProvider()', () => {
  it('returns null when auth is not ready', () => {
    mockIsFeatureReady.mockReturnValue(false);
    expect(getAuthProvider()).toBeNull();
  });

  it('returns the configured provider when auth is ready', () => {
    mockIsFeatureReady.mockReturnValue(true);
    mockAuthConfig.provider = 'nextauth';
    expect(getAuthProvider()).toBe('nextauth');
  });
});
