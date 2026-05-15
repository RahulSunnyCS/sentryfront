import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.REDIS_URL;
    delete process.env.SENTRY_DSN;
    delete process.env.PAGESPEED_API_KEY;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_ENV;
  });

  it('should return ok status when database is healthy', async () => {
    // Route reports 'ok' only when DB is reachable AND all required env vars
    // are present. PAGESPEED_API_KEY is one of route's requiredEnvVars.
    process.env.PAGESPEED_API_KEY = 'test-key';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('ok');
    expect(data.db.status).toBe('ok');
    expect(data.db.type).toBe('sqlite');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });

  it('should return error status when database fails', async () => {
    (prisma.$queryRaw as any).mockRejectedValue(new Error('Connection failed'));

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('error');
    expect(data.db.status).toBe('error');
    expect(data.db.error).toBe('Connection failed');
  });

  it('should detect PostgreSQL from DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.db.type).toBe('postgres');
  });

  it('should detect SQLite from DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'file:./vibesafe.db';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.db.type).toBe('sqlite');
  });

  it('should show redis queue when REDIS_URL is set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.queue).toBe('redis');
  });

  it('should show in-process queue when REDIS_URL is not set', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.queue).toBe('in-process');
  });

  it('should include feature flags', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.features).toBeDefined();
    expect(data.features).toHaveProperty('scanDiff');
    expect(data.features).toHaveProperty('pdfExport');
    expect(data.features).toHaveProperty('stripe');
    expect(data.features).toHaveProperty('auth');
    expect(data.features).toHaveProperty('tierGating');
  });

  it('should report sentry integration disabled by default', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.integrations).toBeDefined();
    expect(data.integrations.sentry).toBe(false);
  });

  it('should detect Sentry when SENTRY_DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.integrations.sentry).toBe(true);
  });

  it('should include git commit SHA when on Vercel', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('abc123d');
  });

  it('should show dev version in development', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBe('dev');
  });

  it('should include environment information', async () => {
    process.env.VERCEL_ENV = 'production';
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.environment).toBe('production');
  });

  it('should have valid ISO timestamp', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date');
  });
});
