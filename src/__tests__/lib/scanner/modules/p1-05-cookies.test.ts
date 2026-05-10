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
