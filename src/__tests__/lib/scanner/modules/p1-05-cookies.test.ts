import { describe, it, expect } from 'vitest';
import { runCookiesModule } from '@/lib/scanner/modules/p1-05-cookies';
import type { CrawlResult, ParsedCookie } from '@/lib/scanner/types';

const createCrawlResult = (cookies: ParsedCookie[]): CrawlResult => ({
  finalUrl: 'https://example.com',
  html: '',
  headers: {},
  cookies,
  localStorage: {},
  sessionStorage: {},
  scripts: [],
  links: [],
  resources: [],
  statusCode: 200,
  inlineScriptContent: '',
  jsBundleUrls: [],
});

describe('P1-05: Cookies & Storage Module', () => {
  describe('Secure Flag', () => {
    it('should flag session cookies without Secure flag', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const secureFinding = findings.find(f => f.title.includes('Secure flag'));
      expect(secureFinding).toBeDefined();
      expect(secureFinding?.severity).toBe('HIGH');
      expect(secureFinding?.location).toContain('session');
    });

    it('should not flag session cookies with Secure flag', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const secureFinding = findings.find(f => f.title.includes('Secure flag'));
      expect(secureFinding).toBeUndefined();
    });

    it('should detect various session cookie patterns', () => {
      const cookieNames = ['auth', 'token', 'jwt', 'next-auth.session', 'PHPSESSID', '_csrf'];
      const cookies: ParsedCookie[] = cookieNames.map(name => ({
        name,
        value: 'test',
        domain: 'example.com',
        path: '/',
        secure: false,
        httpOnly: true,
        sameSite: 'Lax',
      }));

      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const secureFinding = findings.find(f => f.title.includes('Secure flag'));
      expect(secureFinding).toBeDefined();
      expect(secureFinding?.evidence).toContain('(no Secure)');
    });
  });

  describe('HttpOnly Flag', () => {
    it('should flag session cookies without HttpOnly flag', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: false,
          sameSite: 'Lax',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const httpOnlyFinding = findings.find(f => f.title.includes('HttpOnly flag'));
      expect(httpOnlyFinding).toBeDefined();
      expect(httpOnlyFinding?.severity).toBe('HIGH');
      expect(httpOnlyFinding?.moduleId).toBe('P1-05');
      expect(httpOnlyFinding?.category).toBe('Cookie & Storage Hygiene');
      expect(httpOnlyFinding?.location).toContain('session');
    });

    it('should not flag session cookies with HttpOnly flag set', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const httpOnlyFinding = findings.find(f => f.title.includes('HttpOnly flag'));
      expect(httpOnlyFinding).toBeUndefined();
    });

    it('should not flag non-session cookies missing HttpOnly flag', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'theme',
          value: 'dark',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: undefined,
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const httpOnlyFinding = findings.find(f => f.title.includes('HttpOnly flag'));
      expect(httpOnlyFinding).toBeUndefined();
    });
  });

  describe('SameSite Attribute', () => {
    it('should flag session cookies without SameSite', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: undefined,
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const sameSiteFinding = findings.find(f => f.title.includes('SameSite'));
      expect(sameSiteFinding).toBeDefined();
      expect(sameSiteFinding?.severity).toBe('MEDIUM');
    });

    it('should not flag cookies with SameSite=Lax', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const sameSiteFinding = findings.find(f => f.title.includes('SameSite'));
      expect(sameSiteFinding).toBeUndefined();
    });

    it('should not flag cookies with SameSite=Strict', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'auth_token',
          value: 'xyz789',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Strict',
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      const sameSiteFinding = findings.find(f => f.title.includes('SameSite'));
      expect(sameSiteFinding).toBeUndefined();
    });
  });

  describe('No Cookies', () => {
    it('should return empty array when no cookies present', () => {
      const crawlResult = createCrawlResult([]);
      const findings = runCookiesModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Phase 3.5: tightened auth* heuristic', () => {
    it.each(['auth_timeout', 'auth_context', 'auth_redirect', 'auth_callback'])(
      'does not raise findings on flow-state cookie %s (was an FP)',
      (name) => {
        const cookies: ParsedCookie[] = [
          {
            name,
            value: 'some-flow-value',
            domain: 'example.com',
            path: '/',
            secure: false,
            httpOnly: false,
            sameSite: undefined,
          },
        ];
        const crawlResult = createCrawlResult(cookies);
        const findings = runCookiesModule(crawlResult);
        expect(findings).toHaveLength(0);
      },
    );

    it('still flags real auth_token cookies missing Secure', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'auth_token',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: true,
          sameSite: 'Lax',
        },
      ];
      const findings = runCookiesModule(createCrawlResult(cookies));
      expect(findings.find((f) => f.title.includes('Secure flag'))).toBeDefined();
    });
  });

  describe('Non-session Cookies', () => {
    it('should not flag non-session cookies', () => {
      const cookies: ParsedCookie[] = [
        {
          name: 'theme',
          value: 'dark',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: undefined,
        },
        {
          name: 'language',
          value: 'en',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: undefined,
        },
      ];
      const crawlResult = createCrawlResult(cookies);
      const findings = runCookiesModule(crawlResult);

      expect(findings).toHaveLength(0);
    });
  });
});
