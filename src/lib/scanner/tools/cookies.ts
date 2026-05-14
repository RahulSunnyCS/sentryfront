import type { ParsedCookie } from '../types';

// Phase 3.5 — shared session-cookie heuristic. Used by P1-05 (cookie
// security attributes) and P1-15 (cache must-not-store gate).
//
// Pre-3.5 the pattern `/^auth/i` lived inline in p1-05 and FP'd on
// non-session names like `auth_timeout`, `auth_context`, `auth_redirect`,
// `auth_callback` — most sites set those for *flow* state, not session
// identity, but the old heuristic treated them like a session token and
// asked for Secure/HttpOnly. The tightened pattern below requires the
// cookie name to be exactly `auth`, `auth_token`, `auth_session`, or
// `auth_id` (and the `_`/`-`/`.` separator variants), so non-session
// `auth_*` cookies stop tripping it.
export const SESSION_COOKIE_PATTERNS: RegExp[] = [
  /^sess(ion)?$/i,
  /^auth(?:[._-]?(?:token|session|id))?$/i,
  /^token/i,
  /^jwt/i,
  /^supabase/i,
  /^next.?auth/i,
  /^__session/i,
  /^connect\.sid/i,
  /^PHPSESSID/i,
  /^JSESSIONID/i,
  /^_csrf/i,
  /^remember/i,
];

export function looksLikeSessionCookie(cookie: ParsedCookie): boolean {
  return SESSION_COOKIE_PATTERNS.some((re) => re.test(cookie.name));
}
