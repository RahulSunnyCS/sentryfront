import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

const PROTECTED_SEGMENTS = ['dashboard', 'verify', 'active-test'];

const intlMiddleware = createIntlMiddleware(routing);

function isProtected(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return false;
  const [maybeLocale, segment] = parts;
  if (!routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    return PROTECTED_SEGMENTS.includes(maybeLocale);
  }
  return PROTECTED_SEGMENTS.includes(segment);
}

function localePrefix(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const [maybeLocale] = parts;
  if (routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    return maybeLocale;
  }
  return routing.defaultLocale;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isProtected(pathname)) {
    const hasSessionCookie = SESSION_COOKIES.some(
      (name) => req.cookies.get(name)?.value
    );
    if (!hasSessionCookie) {
      const locale = localePrefix(pathname);
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|auth/popup-callback|auth/popup-start|.*\\..*).*)'],
};
