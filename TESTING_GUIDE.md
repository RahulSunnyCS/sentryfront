# VibeSafe Testing Guide

## Overview

VibeSafe uses **Vitest** as the testing framework with React Testing Library for component tests. This guide covers how to write, run, and maintain tests.

## Quick Start

```bash
# Run all tests
npm run test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm run test -- p1-01-secrets.test.ts
```

## Test Structure

```
src/__tests__/
├── fixtures/
│   └── test-data.ts          # Shared test data and mocks
├── lib/
│   ├── scanner/
│   │   └── modules/           # Scanner module tests
│   └── *.test.ts              # Core library tests
├── app/
│   └── api/                   # API route tests
└── components/                # React component tests
```

## Writing Tests

### Scanner Module Tests

Scanner modules test security detection logic. Example:

```typescript
import { describe, it, expect } from 'vitest';
import { runCorsModule } from '@/lib/scanner/modules/p1-07-cors';
import type { CrawlResult } from '@/lib/scanner/types';

describe('P1-07: CORS Configuration', () => {
  it('should flag wildcard CORS as CRITICAL', async () => {
    const crawlResult: CrawlResult = {
      finalUrl: 'https://example.com',
      html: '',
      headers: {},
      // ... other required fields
    };
    
    const findings = await runCorsModule(crawlResult);
    
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].title).toContain('Wildcard CORS');
  });
});
```

### API Route Tests

Test Next.js App Router API routes by importing and calling the route handlers:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return ok status when database is healthy', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);
    
    const response = await GET();
    const data = await response.json();
    
    expect(data.status).toBe('ok');
  });
});
```

### Component Tests

Use React Testing Library for component tests:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SeverityBadge from '@/components/SeverityBadge';

describe('SeverityBadge', () => {
  it('should render CRITICAL severity with red color', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('CRITICAL')).toHaveClass('bg-red-500');
  });
});
```

## Mocking

### Global Mocks

Global mocks are set up in `vitest.setup.ts`:

- **Prisma** - Database client
- **Next.js modules** - `next/navigation`, `next/headers`
- **Sentry** - Error tracking
- **Fetch** - Global fetch function

### Per-Test Mocks

Override mocks in individual tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as any).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: 'test' }),
  });
});
```

## Coverage

### Current Coverage

Run `npm run test:coverage` to see detailed coverage report.

Target thresholds (configured in `vitest.config.ts`):
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Viewing Coverage

Coverage reports are generated in multiple formats:
- **Terminal**: Summary in console
- **HTML**: `coverage/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI/CD)

## Best Practices

1. **Clear Test Names**: Use descriptive test names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests clearly with setup, execution, and verification
3. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
4. **Mock External Dependencies**: Isolate unit tests from external services
5. **Clean Up**: Use `beforeEach`/`afterEach` to reset state between tests
6. **Avoid Test Interdependence**: Each test should be independent and runnable in isolation

## Debugging Tests

### Run Single Test
```bash
npm run test -- --grep "should flag wildcard CORS"
```

### Watch Mode
```bash
npm run test:watch
```
Automatically re-runs tests when files change.

### UI Mode
```bash
npm run test:ui
```
Opens a browser-based UI for exploring and debugging tests.

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Pre-deployment (configured in `.github/workflows/test.yml`)

## Troubleshooting

### Tests Fail Locally
1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear Next.js cache: `rm -rf .next`
3. Check environment variables in `.env` are set

### Prisma Mock Issues
Make sure `vitest.setup.ts` includes `$queryRaw` in the Prisma mock:
```typescript
prisma: {
  $queryRaw: vi.fn(),
  // ... other methods
}
```

### Path Alias Issues
Ensure `vitest.config.ts` has the correct path alias:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Next.js App Router](https://nextjs.org/docs/app/building-your-application/testing/vitest)
