/**
 * Tests for src/app/[locale]/active-test/page.tsx  (T-19 — UI tier gate)
 *
 * ActiveTestPage is an async Server Component. The repo's component tests
 * (src/__tests__/components/*) are all for *client* components rendered with
 * @testing-library/react; there is no in-repo precedent (or RSC test
 * renderer) for mounting an async Server Component. Faking a DOM render of
 * it would be a misleading green.
 *
 * Instead — per the brief's "cover the extractable logic" instruction — we
 * invoke the async component function directly and walk the returned React
 * element tree to assert WHICH branch it rendered: the upgrade prompt
 * (ActiveTestUpgradePrompt) for a below-tier user, or the wizard
 * (ActiveTestFlow) for an entitled user / flags-off. The child components
 * are mocked to tagged sentinels so the assertion is unambiguous and does
 * not depend on their internals.
 *
 * Scenarios: happy (entitled → wizard), security/edge (free → upgrade
 * prompt, no wizard), flag-off (auth disabled OR tier-gating disabled →
 * wizard, byte-identical to before the gate), edge (unauth-but-flagged →
 * treated as 'free' → upgrade prompt).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// ── Module mocks ─────────────────────────────────────────────────────────────

const {
  mockGetCurrentUser,
  mockHasTier,
  mockIsAuthEnabled,
  mockIsTierGatingEnabled,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockHasTier: vi.fn(),
  mockIsAuthEnabled: vi.fn(),
  mockIsTierGatingEnabled: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
  hasTier: mockHasTier,
  isAuthEnabled: mockIsAuthEnabled,
}));

vi.mock('@/lib/tier-gating', () => ({
  isTierGatingEnabled: mockIsTierGatingEnabled,
  getUpgradeMessage: (tier: string) => `upgrade-msg-for-${tier}`,
}));

// Child components reduced to identifiable sentinels.
vi.mock('@/components/nav', () => ({ Nav: () => null }));
vi.mock('@/components/footer', () => ({ Footer: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/[locale]/active-test/active-test-flow', () => ({
  ActiveTestFlow: () => null,
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import ActiveTestPage from '@/app/[locale]/active-test/page';
import { ActiveTestFlow } from '@/app/[locale]/active-test/active-test-flow';

// ── Tree walker: find a rendered element whose type === target ───────────────

function treeContainsType(node: unknown, target: unknown): boolean {
  if (node == null || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((n) => treeContainsType(n, target));
  }
  const el = node as ReactElement;
  if (el.type === target) return true;
  const children = (el.props as { children?: unknown } | undefined)?.children;
  return treeContainsType(children, target);
}

// ActiveTestUpgradePrompt is a nested (non-exported) function component, so
// in the tree returned by the async page its element's `type` is that
// function — we identify the upgrade branch by the component's function
// name rather than reaching into its rendered output.
function treeContainsComponentNamed(node: unknown, name: string): boolean {
  if (node == null || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((n) => treeContainsComponentNamed(n, name));
  }
  const el = node as ReactElement;
  if (typeof el.type === 'function' && (el.type as { name?: string }).name === name) {
    return true;
  }
  const children = (el.props as { children?: unknown } | undefined)?.children;
  return treeContainsComponentNamed(children, name);
}

const UPGRADE_COMPONENT = 'ActiveTestUpgradePrompt';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ActiveTestPage — tier gate branch selection', () => {
  it('renders the upgrade prompt and NOT the wizard for a free user (gate active)', async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockIsTierGatingEnabled.mockReturnValue(true);
    mockGetCurrentUser.mockResolvedValue({ id: 'u', email: 'f@x.com', tier: 'free' });
    mockHasTier.mockReturnValue(false); // free < one-shot

    const tree = await ActiveTestPage({ searchParams: {} });

    expect(treeContainsComponentNamed(tree, UPGRADE_COMPONENT)).toBe(true);
    expect(treeContainsType(tree, ActiveTestFlow)).toBe(false);
    expect(mockHasTier).toHaveBeenCalledWith(
      { id: 'u', email: 'f@x.com', tier: 'free' },
      'one-shot',
    );
  });

  it('renders the wizard and NOT the upgrade prompt for an entitled user', async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockIsTierGatingEnabled.mockReturnValue(true);
    mockGetCurrentUser.mockResolvedValue({ id: 'u', email: 'p@x.com', tier: 'pro' });
    mockHasTier.mockReturnValue(true); // pro satisfies one-shot

    const tree = await ActiveTestPage({ searchParams: {} });

    expect(treeContainsType(tree, ActiveTestFlow)).toBe(true);
    expect(treeContainsComponentNamed(tree, UPGRADE_COMPONENT)).toBe(false);
  });

  it('treats a flagged-but-unauthenticated visitor as "free" → upgrade prompt', async () => {
    // Defense-in-depth edge: middleware normally redirects, but if a request
    // reaches the page with no user while gating is on, it must NOT show the
    // wizard (currentTier falls back to 'free').
    mockIsAuthEnabled.mockReturnValue(true);
    mockIsTierGatingEnabled.mockReturnValue(true);
    mockGetCurrentUser.mockResolvedValue(null);
    mockHasTier.mockReturnValue(false);

    const tree = await ActiveTestPage({ searchParams: {} });

    expect(treeContainsComponentNamed(tree, UPGRADE_COMPONENT)).toBe(true);
    expect(treeContainsType(tree, ActiveTestFlow)).toBe(false);
    expect(mockHasTier).toHaveBeenCalledWith(null, 'one-shot');
  });
});

describe('ActiveTestPage — flag-off behaviour (byte-identical to pre-gate)', () => {
  it('renders the wizard for a free user when auth is disabled', async () => {
    mockIsAuthEnabled.mockReturnValue(false);
    mockIsTierGatingEnabled.mockReturnValue(true);

    const tree = await ActiveTestPage({ searchParams: {} });

    expect(treeContainsType(tree, ActiveTestFlow)).toBe(true);
    expect(treeContainsComponentNamed(tree, UPGRADE_COMPONENT)).toBe(false);
    // Gate must short-circuit before touching the user/tier.
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockHasTier).not.toHaveBeenCalled();
  });

  it('renders the wizard for a free user when tier gating is disabled', async () => {
    mockIsAuthEnabled.mockReturnValue(true);
    mockIsTierGatingEnabled.mockReturnValue(false);

    const tree = await ActiveTestPage({ searchParams: {} });

    expect(treeContainsType(tree, ActiveTestFlow)).toBe(true);
    expect(treeContainsComponentNamed(tree, UPGRADE_COMPONENT)).toBe(false);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockHasTier).not.toHaveBeenCalled();
  });
});
