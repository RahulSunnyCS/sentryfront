/**
 * Auth Helper Functions
 * 
 * Provides unified auth interface regardless of provider (NextAuth or Supabase).
 */

import { getServerSession } from 'next-auth';
import * as Sentry from '@sentry/nextjs';
import { nextAuthConfig } from './nextauth-config';
import { authConfig, isFeatureReady } from '@/lib/features';
import { prisma } from '@/lib/prisma';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  tier: string;
}

export interface AuthSession {
  user: AuthUser;
}

// ── Server-Side Auth Helpers ─────────────────────────────────────────────────

/**
 * Get current user session (server-side)
 * Returns null if not authenticated or auth is disabled
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isFeatureReady('auth')) {
    return null; // Auth is disabled, all users are anonymous
  }

  if (authConfig.provider === 'nextauth') {
    return await getCurrentUserNextAuth();
  }

  if (authConfig.provider === 'supabase') {
    return await getCurrentUserSupabase();
  }

  return null;
}

async function getCurrentUserNextAuth(): Promise<AuthUser | null> {
  const session = await getServerSession(nextAuthConfig);

  if (!session?.user?.email) {
    return null;
  }

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, tier: true },
  });

  if (!user || !user.email) {
    return null;
  }

  // Attribute every authenticated request to the user in Sentry so
  // transaction p50/p95/p99 breakdowns and error events are scoped
  // to a real identity instead of an anonymous server transaction.
  Sentry.setUser({ id: user.id, email: user.email, tier: user.tier ?? 'free' });

  return user as AuthUser;
}

async function getCurrentUserSupabase(): Promise<AuthUser | null> {
  // TODO: Implement Supabase auth when needed
  console.warn('[Auth] Supabase auth not yet implemented');
  return null;
}

/**
 * Require authentication (throws if not authenticated)
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

/**
 * Check if user has required tier
 */
export function hasTier(user: AuthUser | null, requiredTier: string): boolean {
  if (!user) return false;

  const tierHierarchy = ['free', 'one-shot', 'pro', 'studio'];
  const userTierIndex = tierHierarchy.indexOf(user.tier);
  const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

  return userTierIndex >= requiredTierIndex;
}

/**
 * Get user tier (free if not authenticated or auth disabled)
 */
export async function getUserTier(): Promise<string> {
  const user = await getCurrentUser();
  return user?.tier || 'free';
}

// ── Client-Side Auth Status ──────────────────────────────────────────────────

/**
 * Check if auth is enabled (for UI gating)
 */
export function isAuthEnabled(): boolean {
  return isFeatureReady('auth');
}

/**
 * Get auth provider name
 */
export function getAuthProvider(): 'nextauth' | 'supabase' | null {
  if (!isFeatureReady('auth')) return null;
  return authConfig.provider;
}
