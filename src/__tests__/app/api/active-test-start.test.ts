/**
 * Tests for POST /api/v1/active-test/start  (T-19 — authoritative tier gate)
 *
 * This is the SECURITY-CRITICAL half of the two-layer tier gate (the UI
 * gate in active-test/page.tsx is not authoritative). The active DAST
 * surface is a paid feature: per business.md it unlocks at the 'one-shot'
 * tier; 'free' is blocked. This suite verifies, for the auth risk flag:
 *
 *  - Happy path: an entitled tier (one-shot / pro / studio) passes the gate
 *    and a scan is created.
 *  - Security: an unauthenticated request → 401 and NO downstream work.
 *  - Security: a below-tier (free) user → 403 TIER_REQUIRED, and that this
 *    rejection happens BEFORE domain-verification lookup and scan creation
 *    (defense-in-depth ordering — we assert prisma.domainVerification /
 *    prisma.scan are NEVER reached for a below-tier user).
 *  - Edge / flag-off: tier gating disabled → behaviour is byte-identical to
 *    before the gate (a free user passes, mirroring how tier-gating is
 *    bypassed everywhere else).
 *  - Edge: validation ordering after the gate (bad JSON, bad domain, empty
 *    test list) still behaves correctly for an entitled user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks (declared before importing the route) ───────────────────────

const { mockGetCurrentUser, mockHasTier, mockIsTierGatingEnabled } = vi.hoisted(
  () => ({
    mockGetCurrentUser: vi.fn(),
    // hasTier owns the real hierarchy ['free','one-shot','pro','studio'] and
    // is unit-tested separately in src/__tests__/lib/auth/helpers.test.ts.
    // Here we mock it so we can assert the ROUTE's gate ORDERING precisely
    // without coupling to the hierarchy implementation.
    mockHasTier: vi.fn(),
    mockIsTierGatingEnabled: vi.fn(),
  }),
);

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
  hasTier: mockHasTier,
}));

vi.mock('@/lib/tier-gating', () => ({
  isTierGatingEnabled: mockIsTierGatingEnabled,
}));

// normalizeDomain is mocked to a pure identity-ish transform so we control
// when (and whether) it is reached relative to the tier gate.
const { mockNormalizeDomain } = vi.hoisted(() => ({
  mockNormalizeDomain: vi.fn((raw: string) => raw.replace(/^https?:\/\//, '')),
}));
vi.mock('@/lib/verify-domain', () => ({
  normalizeDomain: mockNormalizeDomain,
}));

const { mockRunActiveTest } = vi.hoisted(() => ({
  mockRunActiveTest: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/active-test-worker', () => ({
  estimateSeconds: vi.fn(() => 480),
  isSupportedTest: (k: string) => ['sqli', 'xss', 'fuzz', 'auth', 'cors'].includes(k),
  runActiveTest: mockRunActiveTest,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/v1/active-test/start/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/v1/active-test/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const ENTITLED_USER = { id: 'u-1', email: 'paid@example.com', tier: 'one-shot' };
const FREE_USER = { id: 'u-2', email: 'free@example.com', tier: 'free' };

const VALID_BODY = { domain: 'https://example.com', tests: ['sqli', 'xss'] };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsTierGatingEnabled.mockReturnValue(true);
  mockNormalizeDomain.mockImplementation((raw: string) =>
    raw.replace(/^https?:\/\//, ''),
  );
  (prisma.domainVerification as any) = { findFirst: vi.fn() };
  (prisma.scan as any).create = vi.fn();
  (prisma.scan as any).findMany = vi.fn().mockResolvedValue([]);
});

// ── Authentication (must come first) ─────────────────────────────────────────

describe('POST /api/v1/active-test/start — authentication', () => {
  it('rejects an unauthenticated request with 401 and does no downstream work', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: 'Authentication required.',
    });
    // SECURITY: no tier check, no domain lookup, no scan creation for an
    // anonymous caller.
    expect(mockHasTier).not.toHaveBeenCalled();
    expect((prisma.domainVerification as any).findFirst).not.toHaveBeenCalled();
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
    expect(mockRunActiveTest).not.toHaveBeenCalled();
  });
});

// ── Tier gate (the T-19 security objective) ──────────────────────────────────

describe('POST /api/v1/active-test/start — tier gate (defense-in-depth)', () => {
  it('rejects a below-tier (free) user with 403 TIER_REQUIRED', async () => {
    mockGetCurrentUser.mockResolvedValue(FREE_USER);
    mockHasTier.mockReturnValue(false); // free does not satisfy 'one-shot'

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe('TIER_REQUIRED');
    expect(json.error).toMatch(/paid plan/i);
  });

  it('checks the tier gate with the authoritative minimum "one-shot"', async () => {
    mockGetCurrentUser.mockResolvedValue(FREE_USER);
    mockHasTier.mockReturnValue(false);

    await POST(makeRequest(VALID_BODY));

    // The route must delegate the hierarchy to hasTier (not hard-code it)
    // and ask for the 'one-shot' minimum.
    expect(mockHasTier).toHaveBeenCalledWith(FREE_USER, 'one-shot');
  });

  it('SECURITY: rejects the below-tier user BEFORE any domain-verification or scan work', async () => {
    mockGetCurrentUser.mockResolvedValue(FREE_USER);
    mockHasTier.mockReturnValue(false);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    // The whole point of defense-in-depth ordering: the expensive /
    // trust-bearing work must NOT run for a user the gate rejects.
    expect(mockNormalizeDomain).not.toHaveBeenCalled();
    expect((prisma.domainVerification as any).findFirst).not.toHaveBeenCalled();
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
    expect((prisma.scan as any).findMany).not.toHaveBeenCalled();
    expect(mockRunActiveTest).not.toHaveBeenCalled();
  });

  it('SECURITY: a below-tier user cannot smuggle past the gate even with a verified domain in the DB', async () => {
    mockGetCurrentUser.mockResolvedValue(FREE_USER);
    mockHasTier.mockReturnValue(false);
    // Even if a verified domain row exists, the gate must reject first and
    // never consult it.
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue({ id: 'dv-1', verifiedAt: new Date() });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    expect((prisma.domainVerification as any).findFirst).not.toHaveBeenCalled();
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
  });

  it.each([
    ['one-shot', { id: 'u-3', email: 'a@x.com', tier: 'one-shot' }],
    ['pro', { id: 'u-4', email: 'b@x.com', tier: 'pro' }],
    ['studio', { id: 'u-5', email: 'c@x.com', tier: 'studio' }],
  ])('lets an entitled %s user through the gate to scan creation', async (_tier, user) => {
    mockGetCurrentUser.mockResolvedValue(user);
    mockHasTier.mockReturnValue(true); // entitled tier satisfies 'one-shot'
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue({ id: 'dv-1', verifiedAt: new Date() });
    (prisma.scan as any).create = vi
      .fn()
      .mockResolvedValue({ id: 'scan-99' });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      scan_id: 'scan-99',
      idempotent: false,
    });
    expect((prisma.scan as any).create).toHaveBeenCalledTimes(1);
  });
});

// ── Flag-off behaviour (byte-identical to before the gate) ───────────────────

describe('POST /api/v1/active-test/start — tier gating disabled (flag off)', () => {
  it('lets a free user through when tier gating is disabled (no 403)', async () => {
    mockIsTierGatingEnabled.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue(FREE_USER);
    // hasTier would say false, but the route must short-circuit on the flag
    // and never even consult it — flag-off == pre-gate behaviour.
    mockHasTier.mockReturnValue(false);
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue({ id: 'dv-1', verifiedAt: new Date() });
    (prisma.scan as any).create = vi
      .fn()
      .mockResolvedValue({ id: 'scan-flagoff' });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(mockHasTier).not.toHaveBeenCalled();
    expect((prisma.scan as any).create).toHaveBeenCalledTimes(1);
  });

  it('still requires authentication even when tier gating is disabled', async () => {
    mockIsTierGatingEnabled.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
  });
});

// ── Post-gate validation (only reachable once the gate passes) ───────────────

describe('POST /api/v1/active-test/start — post-gate validation', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockResolvedValue(ENTITLED_USER);
    mockHasTier.mockReturnValue(true);
  });

  it('returns 400 for an invalid JSON body', async () => {
    const badReq = new NextRequest('http://localhost/api/v1/active-test/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });

    const res = await POST(badReq);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
  });

  it('returns 400 when no supported tests are selected', async () => {
    const res = await POST(
      makeRequest({ domain: 'example.com', tests: ['not-a-test'] }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Select at least one supported test.',
    });
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
  });

  it('returns 403 DOMAIN_NOT_VERIFIED for an entitled user with an unverified domain', async () => {
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: 'DOMAIN_NOT_VERIFIED',
    });
    expect((prisma.scan as any).create).not.toHaveBeenCalled();
  });

  it('de-duplicates repeated test keys before scheduling the scan', async () => {
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue({ id: 'dv-1', verifiedAt: new Date() });
    const create = vi.fn().mockResolvedValue({ id: 'scan-1' });
    (prisma.scan as any).create = create;

    await POST(
      makeRequest({ domain: 'example.com', tests: ['sqli', 'sqli', 'xss'] }),
    );

    const summary = JSON.parse(create.mock.calls[0][0].data.summary);
    expect(summary.tests).toEqual(['sqli', 'xss']);
    expect(mockRunActiveTest).toHaveBeenCalledWith('scan-1', ['sqli', 'xss']);
  });

  it('returns the existing scan for a matching idempotency-key without creating a new one', async () => {
    (prisma.domainVerification as any).findFirst = vi
      .fn()
      .mockResolvedValue({ id: 'dv-1', verifiedAt: new Date() });
    (prisma.scan as any).findMany = vi.fn().mockResolvedValue([
      {
        id: 'scan-existing',
        summary: JSON.stringify({ mode: 'active', idempotencyKey: 'key-abc' }),
      },
    ]);
    const create = vi.fn();
    (prisma.scan as any).create = create;

    const res = await POST(
      makeRequest(VALID_BODY, { 'idempotency-key': 'key-abc' }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      scan_id: 'scan-existing',
      idempotent: true,
    });
    expect(create).not.toHaveBeenCalled();
  });
});
