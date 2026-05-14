import { describe, it, expect, afterEach } from 'vitest';
import { isAdminUser } from '@/lib/auth/helpers';

const ORIGINAL = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

function user(email: string | null): { id: string; email: string; tier: string } | null {
  if (email === null) return null;
  return { id: 'u1', email, tier: 'free' };
}

describe('isAdminUser', () => {
  it('returns false for null user', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdminUser(null)).toBe(false);
  });

  it('returns false when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminUser(user('a@x.com'))).toBe(false);
  });

  it('returns false when ADMIN_EMAILS is empty string', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminUser(user('a@x.com'))).toBe(false);
  });

  it('returns true on exact match', () => {
    process.env.ADMIN_EMAILS = 'me@example.com';
    expect(isAdminUser(user('me@example.com'))).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    process.env.ADMIN_EMAILS = 'Me@Example.COM';
    expect(isAdminUser(user('ME@example.com'))).toBe(true);
  });

  it('trims whitespace around each entry', () => {
    process.env.ADMIN_EMAILS = ' a@x.com , b@y.com ,  ';
    expect(isAdminUser(user('a@x.com'))).toBe(true);
    expect(isAdminUser(user('b@y.com'))).toBe(true);
    expect(isAdminUser(user('c@z.com'))).toBe(false);
  });

  it('returns false for non-listed users', () => {
    process.env.ADMIN_EMAILS = 'admin@x.com';
    expect(isAdminUser(user('user@x.com'))).toBe(false);
  });
});
