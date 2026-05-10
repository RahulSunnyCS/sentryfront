import type { CrawlResult, RawFinding } from '@/lib/scanner/types';

/**
 * Mock CrawlResult for testing scanner modules
 */
export const mockCrawlResult: CrawlResult = {
  finalUrl: 'https://example.com',
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
        <script src="https://cdn.example.com/app.js"></script>
      </head>
      <body>
        <h1>Test Page</h1>
        <p>This is a test page</p>
      </body>
    </html>
  `,
  headers: {
    'content-type': 'text/html; charset=utf-8',
    'x-frame-options': 'DENY',
  },
  cookies: [
    {
      name: 'session',
      value: 'abc123',
      domain: 'example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ],
  localStorage: {},
  sessionStorage: {},
  scripts: [
    { url: 'https://cdn.example.com/app.js', inline: false, content: '' },
  ],
  links: ['https://example.com/about', 'https://example.com/contact'],
  resources: [
    { url: 'https://example.com/logo.png', type: 'image' },
  ],
  statusCode: 200,
  tlsInfo: {
    protocol: 'TLSv1.3',
    cipher: 'TLS_AES_128_GCM_SHA256',
    validFrom: '2024-01-01',
    validTo: '2025-01-01',
    issuer: 'Let\'s Encrypt',
    subjectAltNames: ['example.com', 'www.example.com'],
  },
};

/**
 * Mock CrawlResult with security issues
 */
export const mockInsecureCrawlResult: CrawlResult = {
  ...mockCrawlResult,
  finalUrl: 'http://insecure.example.com',
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <script>
          const API_KEY = "test-api-key-12345";
          const configValue = "some-config-value";
        </script>
        <script src="http://insecure-cdn.com/tracker.js"></script>
      </head>
      <body>
        <img src="http://example.com/image.jpg" />
      </body>
    </html>
  `,
  headers: {},
  cookies: [
    {
      name: 'auth_token',
      value: 'secret123',
      domain: 'insecure.example.com',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'None',
    },
  ],
  localStorage: {
    userEmail: 'test@example.com',
    apiKey: 'secret-key-123',
  },
  statusCode: 200,
};

/**
 * Mock RawFinding for testing
 */
export const mockFinding: RawFinding = {
  moduleId: 'P1-01',
  severity: 'HIGH',
  category: 'Client-Side Secret Exposure',
  title: 'API key exposed in client-side code',
  location: 'inline script',
  evidence: 'const API_KEY = "sk_live_****xyz";',
  explanation: 'A secret API key was found in client-side JavaScript code.',
  impact: 'Attackers can steal the API key and make unauthorized API calls.',
  fixManual: [
    'Move API keys to server-side environment variables',
    'Never expose secret keys in client-side code',
  ],
  fixAiPrompt: 'Move this API key to a server-side environment variable and create a secure API endpoint instead.',
};

/**
 * Mock Scan database record
 */
export const mockScan = {
  id: 'scan_123',
  targetUrl: 'https://example.com',
  status: 'COMPLETED',
  grade: 'B',
  score: 75,
  stack: 'Next.js',
  summary: JSON.stringify({
    total: 5,
    critical: 0,
    high: 2,
    medium: 2,
    low: 1,
    info: 0,
  }),
  requesterIp: '127.0.0.1',
  tier: 'FREE',
  startedAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: new Date('2024-01-01T00:01:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  userId: null,
};

/**
 * Mock Finding database record
 */
export const mockFindingRecord = {
  id: 'finding_123',
  scanId: 'scan_123',
  moduleId: 'P1-01',
  severity: 'HIGH',
  category: 'Client-Side Secret Exposure',
  title: 'API key exposed in client-side code',
  location: 'inline script',
  evidence: 'const API_KEY = "sk_live_****xyz";',
  explanation: 'A secret API key was found in client-side JavaScript code.',
  impact: 'Attackers can steal the API key and make unauthorized API calls.',
  createdAt: new Date('2024-01-01T00:01:00Z'),
};
