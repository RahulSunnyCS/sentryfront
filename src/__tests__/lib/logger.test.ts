/**
 * Unit tests for src/lib/logger.ts
 *
 * Sentry is mocked in vitest.setup.ts. console.log is also mocked there.
 * We spy on console.log here to inspect what the logger writes.
 *
 * The logger branches on process.env.NODE_ENV:
 *   - 'production' → JSON.stringify(entry) via console.log
 *   - anything else → human-readable via console.log
 *
 * Tests restore NODE_ENV after each case to avoid cross-test pollution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';

// The logger module exports a singleton. Importing it directly (not re-importing
// per test) is safe because the Logger class reads process.env.NODE_ENV at
// call-time inside write(), not at import time.
import { logger } from '@/lib/logger';

// ── Helpers ───────────────────────────────────────────────────────────────────

// vi.stubEnv is the safe Vitest way to temporarily override env vars —
// it handles the read-only restriction on NODE_ENV and restores automatically
// when vi.unstubAllEnvs() is called.
function setEnv(env: string) {
  vi.stubEnv('NODE_ENV', env);
}

function restoreEnv() {
  vi.unstubAllEnvs();
}

// ── logger.info ───────────────────────────────────────────────────────────────

describe('logger.info()', () => {
  it('calls console.log', () => {
    logger.info('hello world');
    expect(console.log).toHaveBeenCalled();
  });

  it('includes the message in the output', () => {
    logger.info('my info message');
    const call = vi.mocked(console.log).mock.calls.find((args) =>
      String(args[0]).includes('my info message'),
    );
    expect(call).toBeDefined();
  });

  it('includes context in output when provided', () => {
    logger.info('with context', { userId: 'u-1', scanId: 's-1' });
    // In non-production mode the context is JSON.stringify'd in the log line
    const allOutput = vi.mocked(console.log).mock.calls.map((args) => String(args[0])).join('\n');
    expect(allOutput).toContain('u-1');
  });

  it('omits context key from output when context is empty', () => {
    logger.info('no context', {});
    const allOutput = vi.mocked(console.log).mock.calls.map((args) => String(args[0])).join('\n');
    // An empty context object should not produce a "context" key in the log entry
    expect(allOutput).not.toContain('"context"');
  });
});

// ── logger.debug ──────────────────────────────────────────────────────────────

describe('logger.debug()', () => {
  it('calls console.log with the message', () => {
    logger.debug('debug message');
    expect(console.log).toHaveBeenCalled();
    const allOutput = vi.mocked(console.log).mock.calls.map((args) => String(args[0])).join('\n');
    expect(allOutput).toContain('debug message');
  });
});

// ── logger.warn ───────────────────────────────────────────────────────────────

describe('logger.warn()', () => {
  it('calls console.log', () => {
    logger.warn('a warning');
    expect(console.log).toHaveBeenCalled();
  });

  it('does NOT call Sentry.captureException when no error is passed', () => {
    logger.warn('just a warning message');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('calls Sentry.captureException with warning level when an error is passed', () => {
    const err = new Error('something concerning');
    logger.warn('warning with error', { scanId: 'scan-42' }, err);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('includes context in the Sentry extra data', () => {
    const err = new Error('ctx warn');
    const ctx = { userId: 'u-99', ip: '10.0.0.1' };
    logger.warn('warn with ctx', ctx, err);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        contexts: expect.objectContaining({ custom: ctx }),
      }),
    );
  });
});

// ── logger.error ──────────────────────────────────────────────────────────────

describe('logger.error()', () => {
  it('calls console.log', () => {
    logger.error('an error occurred');
    expect(console.log).toHaveBeenCalled();
  });

  it('calls Sentry.captureException when an Error object is supplied', () => {
    const err = new Error('db connection lost');
    logger.error('database error', {}, err);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('calls Sentry.captureMessage when no Error object is supplied', () => {
    logger.error('something went wrong without an error object');

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'something went wrong without an error object',
      expect.objectContaining({ level: 'error' }),
    );
  });

  it('includes error name, message, and stack in the log entry', () => {
    const err = new Error('stack trace test');
    // Make the stack deterministic for assertion
    err.stack = 'Error: stack trace test\n    at Object.<anonymous>';
    logger.error('error with stack', {}, err);

    // In non-production mode the logger emits both the formatted line and the stack
    const allOutput = vi.mocked(console.log).mock.calls.map((args) => String(args[0])).join('\n');
    expect(allOutput).toContain('stack trace test');
  });

  it('includes context in the Sentry extra data for error with object', () => {
    const err = new Error('ctx error');
    const ctx = { scanId: 'scan-xyz', requestId: 'req-1' };
    logger.error('error with context', ctx, err);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        contexts: expect.objectContaining({ custom: ctx }),
      }),
    );
  });
});

// ── Production JSON format ────────────────────────────────────────────────────

describe('production JSON output', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('writes a valid JSON string to console.log in production mode', () => {
    setEnv('production');

    logger.info('prod message', { userId: 'u-prod' });

    // The logger calls console.log(JSON.stringify(entry)) in production
    const calls = vi.mocked(console.log).mock.calls;
    const jsonCall = calls.find((args) => {
      try {
        const parsed = JSON.parse(String(args[0]));
        return parsed.message === 'prod message';
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
  });

  it('JSON output includes timestamp, level, and message fields', () => {
    setEnv('production');

    logger.warn('prod warning');

    const calls = vi.mocked(console.log).mock.calls;
    let entry: Record<string, unknown> | null = null;
    for (const args of calls) {
      try {
        const parsed = JSON.parse(String(args[0]));
        if (parsed.message === 'prod warning') {
          entry = parsed;
          break;
        }
      } catch {
        // not a JSON call — skip
      }
    }

    expect(entry).not.toBeNull();
    expect(entry!.timestamp).toBeDefined();
    expect(entry!.level).toBe('warn');
    expect(entry!.message).toBe('prod warning');
  });

  it('JSON output includes error fields when an error is passed', () => {
    setEnv('production');

    const err = new Error('prod error message');
    logger.error('prod error', {}, err);

    const calls = vi.mocked(console.log).mock.calls;
    let entry: Record<string, unknown> | null = null;
    for (const args of calls) {
      try {
        const parsed = JSON.parse(String(args[0]));
        if (parsed.message === 'prod error') {
          entry = parsed;
          break;
        }
      } catch {
        // not JSON
      }
    }

    expect(entry).not.toBeNull();
    expect((entry!.error as Record<string, unknown>).name).toBe('Error');
    expect((entry!.error as Record<string, unknown>).message).toBe('prod error message');
  });
});

// ── logger.setUser / clearUser / breadcrumb / setScanScope ───────────────────

describe('Sentry integration helpers', () => {
  it('setUser calls Sentry.setUser', () => {
    logger.setUser({ id: 'u-1', email: 'a@b.com', tier: 'pro' });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u-1', email: 'a@b.com', tier: 'pro' });
  });

  it('clearUser calls Sentry.setUser(null)', () => {
    logger.clearUser();
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('breadcrumb calls Sentry.addBreadcrumb with the message', () => {
    logger.breadcrumb('user clicked submit', { button: 'submit' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'user clicked submit' }),
    );
  });

  it('setScanScope calls Sentry.setTag with scan_id', () => {
    logger.setScanScope('scan-abc-123');
    expect(Sentry.setTag).toHaveBeenCalledWith('scan_id', 'scan-abc-123');
  });
});
