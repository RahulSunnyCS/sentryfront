import type { CrawlResult, RawFinding } from '../types';
import { looksLikeSessionCookie } from '../tools/cookies';

function looksLikeJWT(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return typeof payload === 'object' && payload !== null;
  } catch {
    return false;
  }
}

export function runCookiesModule(crawl: CrawlResult): RawFinding[] {
  const findings: RawFinding[] = [];
  const { cookies } = crawl;

  if (cookies.length === 0) return findings;

  const insecureSessionCookies = cookies.filter(
    (c) => looksLikeSessionCookie(c) && !c.secure,
  );

  if (insecureSessionCookies.length > 0) {
    const names = insecureSessionCookies.map((c) => c.name).join(', ');
    findings.push({
      moduleId: 'P1-05',
      severity: 'HIGH',
      category: 'Cookie & Storage Hygiene',
      title: `Session cookie${insecureSessionCookies.length > 1 ? 's' : ''} missing Secure flag`,
      location: `Set-Cookie: ${names}`,
      evidence: insecureSessionCookies.map((c) => `${c.name}=...; (no Secure)`).join('\n'),
      explanation: "The Secure flag prevents cookies from being sent over unencrypted HTTP connections. Without it, session cookies can be transmitted in plaintext if a user visits your site over HTTP — even briefly during a redirect.",
      impact: 'Session tokens transmitted over HTTP can be intercepted by attackers on the same network, resulting in account takeover.',
      fixManual: [
        'Add the Secure attribute to all authentication cookies.',
        'In Next.js, set cookies with { secure: true } in your API routes.',
        'Also ensure the site enforces HTTPS and sends HSTS headers.',
      ],
      fixAiPrompt: `My session cookies (${names}) are missing the Secure flag. Update my Next.js API routes to set all auth cookies with { secure: true, httpOnly: true, sameSite: 'lax' }.`,
    });
  }

  const noSameSiteSessionCookies = cookies.filter(
    (c) => looksLikeSessionCookie(c) && !c.sameSite,
  );

  if (noSameSiteSessionCookies.length > 0) {
    const names = noSameSiteSessionCookies.map((c) => c.name).join(', ');
    findings.push({
      moduleId: 'P1-05',
      severity: 'MEDIUM',
      category: 'Cookie & Storage Hygiene',
      title: `Session cookie${noSameSiteSessionCookies.length > 1 ? 's' : ''} missing SameSite attribute`,
      location: `Set-Cookie: ${names}`,
      evidence: noSameSiteSessionCookies.map((c) => `${c.name}=...; (no SameSite)`).join('\n'),
      explanation: 'Without SameSite=Lax or Strict, session cookies are sent on cross-site requests, making them vulnerable to Cross-Site Request Forgery (CSRF) attacks.',
      impact: 'A malicious page can submit forms and make authenticated requests to your API on behalf of logged-in users.',
      fixManual: [
        "Add SameSite=Lax (recommended for most apps) or SameSite=Strict to auth cookies.",
        "In Next.js: { sameSite: 'lax' } in your Set-Cookie options.",
      ],
      fixAiPrompt: `My session cookies (${names}) are missing the SameSite attribute. Add SameSite=Lax to prevent CSRF attacks.`,
    });
  }

  // Check for JWT values in cookies — flag if role/subscription claims are present
  for (const cookie of cookies) {
    if (!looksLikeJWT(cookie.value)) continue;
    try {
      const parts = cookie.value.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as Record<string, unknown>;
      const sensitiveKeys = Object.keys(payload).filter((k) =>
        /role|tier|plan|premium|admin|subscription|is_pro|level/i.test(k),
      );
      if (sensitiveKeys.length > 0) {
        const preview = sensitiveKeys
          .map((k) => `"${k}": ${JSON.stringify(payload[k])}`)
          .join(', ')
          .slice(0, 120);
        findings.push({
          moduleId: 'P1-05',
          severity: 'HIGH',
          category: 'Cookie & Storage Hygiene',
          title: `JWT with authorization claims in cookie: ${cookie.name}`,
          location: `Cookie: ${cookie.name}`,
          evidence: `Decoded payload contains: { ${preview} }`,
          explanation: 'This cookie contains a JWT with claims that control access levels (role, tier, subscription, etc.). If the client trusts these claims without server-side verification, users may be able to forge elevated permissions.',
          impact: 'If authorization decisions rely on JWT claims without server verification, users can modify the token to escalate privileges or bypass paywalls.',
          fixManual: [
            'Never trust JWT claims from the client for authorization decisions.',
            'Always verify authorization server-side from your database.',
            'Avoid putting role/tier claims in JWTs sent to the client.',
          ],
          fixAiPrompt: `My ${cookie.name} JWT contains authorization claims (${sensitiveKeys.join(', ')}). Verify subscription/role server-side in my Next.js middleware instead of reading from the JWT payload.`,
        });
      }
    } catch { /* not a valid JWT */ }
  }

  return findings;
}
