import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    finding: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    findingDisposition: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    scanEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      create: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => ({
      newContext: vi.fn(() => ({
        newPage: vi.fn(() => ({
          goto: vi.fn(),
          content: vi.fn(),
          close: vi.fn(),
          on: vi.fn(),
          route: vi.fn(),
        })),
        close: vi.fn(),
      })),
      close: vi.fn(),
    })),
  },
}));

// Mock Sentry
// startSpan must execute the callback and return its result so that code
// under test (scan-worker, scanner/index) behaves identically with and
// without a real Sentry DSN. A plain vi.fn() would return undefined and
// break any code that awaits the span result.
// setMeasurement is a documented no-op when Sentry is not initialised — we
// mirror that by making it a silent vi.fn() here.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withSentryConfig: (config: any) => config,
  setTag: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
  addBreadcrumb: vi.fn(),
  // startSpan: invoke the callback and pass it a no-op span object so
  // callers that reference the span argument (e.g. T-02 scan-worker) work
  // without a real Sentry connection. Returns a Promise so `await` works.
  startSpan: vi.fn((_options: any, callback: (span: any) => any) =>
    Promise.resolve(callback({ setAttribute: vi.fn(), setStatus: vi.fn() })),
  ),
  setMeasurement: vi.fn(),
}));

// Mock NextAuth
vi.mock('next-auth', () => ({
  default: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});
