import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from './logger';

export interface RateLimitOutcome {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface NamedLimiter {
  name: string;
  limit(identifier: string): Promise<RateLimitOutcome>;
}

type Window = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  logger.info('Upstash not configured; short-window rate limiting is disabled (no-op).');
}

function makeLimiter(name: string, tokens: number, window: Window): NamedLimiter {
  if (!redis) {
    return {
      name,
      async limit() {
        return { success: true, limit: tokens, remaining: tokens, reset: Date.now() + 1000 };
      },
    };
  }

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `rl:${name}`,
    analytics: false,
  });

  return {
    name,
    async limit(identifier: string) {
      const r = await rl.limit(identifier);
      const retryAfter = r.success ? undefined : Math.max(0, Math.ceil((r.reset - Date.now()) / 1000));
      return {
        success: r.success,
        limit: r.limit,
        remaining: r.remaining,
        reset: r.reset,
        retryAfter,
      };
    },
  };
}

export const limiters = {
  verifyUser: makeLimiter('verify:user', 1, '1 s'),
  verifyDomain: makeLimiter('verify:domain', 10, '60 s'),
};

export function rateLimitHeaders(r: RateLimitOutcome): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': r.limit.toString(),
    'X-RateLimit-Remaining': r.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(r.reset / 1000).toString(),
  };
  if (r.retryAfter !== undefined) headers['Retry-After'] = r.retryAfter.toString();
  return headers;
}
