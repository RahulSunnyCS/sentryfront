import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/features', () => ({
  authConfig: { enabled: true, provider: 'nextauth' },
}));

import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

function makeReq(body?: unknown): any {
  return {
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
    nextUrl: { protocol: 'http:' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('whatever', 'not-a-valid-hash')).toBe(false);
  });
});

describe('POST /api/auth/signup', () => {
  it('rejects an invalid email', async () => {
    const res = await signup(makeReq({ email: 'nope', password: 'longenough1' }));
    expect(res.status).toBe(400);
  });

  it('rejects a short password', async () => {
    const res = await signup(makeReq({ email: 'a@b.com', password: 'short' }));
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate account', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });
    const res = await signup(makeReq({ email: 'a@b.com', password: 'longenough1' }));
    expect(res.status).toBe(409);
  });

  it('creates the user and establishes a session', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'u1' });
    (prisma.session.create as any).mockResolvedValue({});

    const res = await signup(makeReq({ name: 'Jane', email: 'Jane@B.com', password: 'longenough1' }));

    expect(res.status).toBe(201);
    const createArg = (prisma.user.create as any).mock.calls[0][0];
    expect(createArg.data.email).toBe('jane@b.com'); // normalized
    expect(createArg.data.passwordHash).toMatch(/^scrypt\$/);
    expect(createArg.data.passwordHash).not.toContain('longenough1');
    expect(prisma.session.create).toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for an unknown account', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await login(makeReq({ email: 'a@b.com', password: 'whatever1' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong password', async () => {
    const passwordHash = await hashPassword('the-real-password');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', passwordHash });
    const res = await login(makeReq({ email: 'a@b.com', password: 'wrong-password' }));
    expect(res.status).toBe(401);
  });

  it('signs in with valid credentials', async () => {
    const passwordHash = await hashPassword('the-real-password');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', passwordHash });
    (prisma.session.create as any).mockResolvedValue({});
    const res = await login(makeReq({ email: 'a@b.com', password: 'the-real-password' }));
    expect(res.status).toBe(200);
    expect(prisma.session.create).toHaveBeenCalled();
  });
});
