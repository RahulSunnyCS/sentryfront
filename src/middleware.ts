import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some(
    (name) => req.cookies.get(name)?.value
  );

  if (hasSessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', req.url);
  const next = req.nextUrl.pathname + req.nextUrl.search;
  loginUrl.searchParams.set('next', next);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/verify',
    '/verify/:path*',
    '/active-test',
    '/active-test/:path*',
  ],
};
