/**
 * Tests for src/lib/report-access.ts
 *
 * canViewScan() implements the visibility rule:
 *   - scan.userId === null → always viewable (anonymous/public scan)
 *   - user !== null && user.id === scan.userId → owner can view
 *   - everything else → not viewable
 */

import { describe, it, expect } from 'vitest';
import { canViewScan } from '@/lib/report-access';
import type { AuthUser } from '@/lib/auth/helpers';

// Minimal AuthUser stub
function makeUser(id: string): AuthUser {
  return { id, email: 'user@example.com', name: 'Test User', tier: 'free' } as AuthUser;
}

describe('canViewScan', () => {
  it('returns true when scan has no owner (public scan)', () => {
    expect(canViewScan({ userId: null }, null)).toBe(true);
    expect(canViewScan({ userId: null }, makeUser('user-1'))).toBe(true);
  });

  it('returns true when the requesting user owns the scan', () => {
    const user = makeUser('user-42');
    expect(canViewScan({ userId: 'user-42' }, user)).toBe(true);
  });

  it('returns false when user is null and scan has an owner', () => {
    expect(canViewScan({ userId: 'user-42' }, null)).toBe(false);
  });

  it('returns false when a different user tries to view an owned scan', () => {
    const user = makeUser('user-99');
    expect(canViewScan({ userId: 'user-42' }, user)).toBe(false);
  });

  it('returns false when user.id does not match scan.userId', () => {
    const user = makeUser('attacker-1');
    expect(canViewScan({ userId: 'victim-2' }, user)).toBe(false);
  });
});
