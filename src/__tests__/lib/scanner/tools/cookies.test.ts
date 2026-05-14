import { describe, it, expect } from 'vitest';
import { looksLikeSessionCookie } from '@/lib/scanner/tools/cookies';
import type { ParsedCookie } from '@/lib/scanner/types';

const cookie = (name: string): ParsedCookie => ({
  name,
  value: 'x',
  secure: false,
  httpOnly: false,
  sameSite: null,
  domain: null,
  path: null,
});

describe('looksLikeSessionCookie', () => {
  describe('Phase 3.5: tightened auth* heuristic', () => {
    it.each([
      'auth',
      'auth_token',
      'auth-token',
      'auth.token',
      'authtoken',
      'auth_session',
      'authsession',
      'auth_id',
      'authid',
      'Auth_Token', // case-insensitive
    ])('classifies %s as a session cookie', (name) => {
      expect(looksLikeSessionCookie(cookie(name))).toBe(true);
    });

    it.each([
      'auth_timeout',
      'auth_context',
      'auth_redirect',
      'auth_url',
      'auth_callback',
      'auth_state',
      'authentication_required',
    ])('does NOT classify %s as a session cookie (FP closed)', (name) => {
      expect(looksLikeSessionCookie(cookie(name))).toBe(false);
    });
  });

  describe('common session cookies still match', () => {
    it.each([
      'session',
      'sess',
      'SESSION',
      'connect.sid',
      'PHPSESSID',
      'JSESSIONID',
      'next-auth.session-token',
      '__session',
      'supabase-auth-token',
      '_csrf',
      'remember_me',
      'jwt',
      'token',
    ])('classifies %s as a session cookie', (name) => {
      expect(looksLikeSessionCookie(cookie(name))).toBe(true);
    });
  });

  describe('tracking cookies do NOT classify as session cookies', () => {
    it.each([
      '_ga',
      '_gid',
      '_gcl_au',
      '_fbp',
      '_hjid',
      '_pinterest_sess', // starts with `_pin`, not in list
      'mp_mixpanel',
      'amplitude_id',
      'intercom-id',
    ])('does NOT classify %s as a session cookie', (name) => {
      expect(looksLikeSessionCookie(cookie(name))).toBe(false);
    });
  });
});
