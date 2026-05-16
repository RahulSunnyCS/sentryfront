/**
 * Unit tests for src/lib/auth/nextauth-config.ts
 *
 * The module is imported after mocks so the PrismaAdapter call and provider
 * constructors resolve cleanly. We test the callbacks and events that contain
 * real application logic; provider/adapter wiring is structural and tested
 * only via shape assertions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next-auth providers ─────────────────────────────────────────────────
// The providers do nothing in tests — we only care that config shape is right.
vi.mock('next-auth/providers/github', () => ({
  default: vi.fn((opts) => ({ id: 'github', ...opts })),
}));
vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((opts) => ({ id: 'google', ...opts })),
}));

// The PrismaAdapter is opaque in tests; return a recognisable sentinel.
vi.mock('@next-auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({ name: '__PrismaAdapter__' })),
}));

// features.authConfig drives provider credentials — set deterministic values.
vi.mock('@/lib/features', () => ({
  authConfig: {
    provider: 'nextauth',
    nextauth: {
      url: 'http://localhost:3000',
      secret: 'test-secret',
      github: { id: 'gh-id', secret: 'gh-secret' },
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
    },
  },
  isFeatureReady: vi.fn(() => true),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { nextAuthConfig } from '@/lib/auth/nextauth-config';
import { prisma } from '@/lib/prisma';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('nextAuthConfig shape', () => {
  it('exposes a session callback', () => {
    expect(typeof nextAuthConfig.callbacks?.session).toBe('function');
  });

  it('configures database session strategy with 30-day maxAge', () => {
    expect(nextAuthConfig.session?.strategy).toBe('database');
    expect(nextAuthConfig.session?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('includes at least two providers', () => {
    expect(Array.isArray(nextAuthConfig.providers)).toBe(true);
    expect(nextAuthConfig.providers.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes a createUser event handler', () => {
    expect(typeof nextAuthConfig.events?.createUser).toBe('function');
  });
});

// ── session callback ─────────────────────────────────────────────────────────

describe('session callback', () => {
  const sessionCallback = nextAuthConfig.callbacks!.session!;

  it('attaches user id and tier from the database to the session', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      tier: 'pro',
      emailVerified: new Date(),
    } as any);

    const session = { user: { name: 'Alice', email: 'alice@example.com' } } as any;
    const user = { id: 'user-123' } as any;

    const result = await sessionCallback({ session, user, token: undefined as any, newSession: undefined as any, trigger: undefined as any });

    expect((result.user as any).id).toBe('user-123');
    expect((result.user as any).tier).toBe('pro');
    expect((result.user as any).emailVerified).toBe(true);
  });

  it('defaults tier to "free" when db user has no tier', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      tier: null,
      emailVerified: null,
    } as any);

    const session = { user: { name: 'Bob' } } as any;
    const user = { id: 'user-456' } as any;

    const result = await sessionCallback({ session, user, token: undefined as any, newSession: undefined as any, trigger: undefined as any });

    expect((result.user as any).tier).toBe('free');
  });

  it('returns the session unchanged when session.user is absent', async () => {
    // Some edge cases (e.g. token-based flows) may not carry a user object.
    const session = {} as any;
    const user = { id: 'u1' } as any;

    const result = await sessionCallback({ session, user, token: undefined as any, newSession: undefined as any, trigger: undefined as any });

    // No crash and nothing unexpected added
    expect(result).toEqual({});
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('marks emailVerified as false when db user has no emailVerified date', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      tier: 'free',
      emailVerified: null,
    } as any);

    const session = { user: {} } as any;
    const user = { id: 'user-789' } as any;

    const result = await sessionCallback({ session, user, token: undefined as any, newSession: undefined as any, trigger: undefined as any });

    expect((result.user as any).emailVerified).toBe(false);
  });
});

// ── createUser event ─────────────────────────────────────────────────────────

describe('createUser event', () => {
  const createUser = nextAuthConfig.events!.createUser!;

  it('marks the user emailVerified on creation', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    await createUser({ user: { id: 'new-user-1' } } as any);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'new-user-1' },
        data: expect.objectContaining({ emailVerified: expect.any(Date) }),
      }),
    );
  });

  it('does nothing when user id is missing', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    // user.id is falsy — guard branch: if (user.id)
    await createUser({ user: {} } as any);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
