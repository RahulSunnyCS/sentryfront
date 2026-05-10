/**
 * Scan worker stub — Phase 2.
 *
 * Simulates the 15-module pipeline by sleeping briefly per module and writing
 * fixture findings to the DB. Real detection logic is added in Phase 3.
 *
 * Called either:
 *   - Directly (fire-and-forget Promise) when REDIS_URL is not set.
 *   - Via BullMQ when REDIS_URL is set.
 */

import { prisma } from './prisma';
import { publishEvent } from './events';

const MODULES = [
  'P1-01', 'P1-02', 'P1-03', 'P1-04', 'P1-05',
  'P1-06', 'P1-07', 'P1-08', 'P1-09', 'P1-10',
  'P1-11', 'P1-12', 'P1-13', 'P1-14', 'P1-15',
] as const;

const FIXTURE_COUNTS: Record<string, number> = {
  'P1-01': 1, 'P1-02': 1, 'P1-03': 2, 'P1-04': 0,
  'P1-05': 1, 'P1-06': 1, 'P1-07': 1, 'P1-08': 1,
  'P1-09': 1, 'P1-10': 0, 'P1-11': 0, 'P1-12': 0,
  'P1-13': 1, 'P1-14': 1, 'P1-15': 0,
};

const FIXTURE_FINDINGS = [
  {
    moduleId: 'P1-01', severity: 'CRITICAL', category: 'Client-Side Secret Exposure',
    title: 'Stripe live secret key exposed in JavaScript bundle',
    location: '/assets/index-3f7a2c.js (line 1,847)',
    evidence: 'const stripeClient = new Stripe("sk_live_51Hx****...****e4Rk");',
    explanation: 'Your Stripe live secret key is hardcoded in client-side JavaScript. Unlike publishable keys (pk_live_), secret keys grant full access to your Stripe account and are visible to anyone who opens browser dev tools.',
    impact: 'An attacker could create charges, issue refunds, access customer payment data, and modify your Stripe account settings.',
    fixManual: JSON.stringify([
      'Remove the secret key from all client-side code immediately.',
      'Create a server-side API route (e.g., /api/create-payment-intent) that uses the key.',
      'Rotate the compromised key in Stripe Dashboard → Developers → API keys.',
      'Use only the publishable key (pk_live_) in client-side code.',
    ]),
    fixAiPrompt: 'I have a Stripe live secret key hardcoded in my client-side JS. Move all Stripe API calls to a server-side API route in Next.js, use only the publishable key on the client, and create a /api/create-payment-intent endpoint.',
  },
  {
    moduleId: 'P1-06', severity: 'CRITICAL', category: 'Sensitive Path Exposure',
    title: 'Environment file (.env) publicly accessible',
    location: '/.env',
    evidence: 'DATABASE_URL=postgres://taskflow:****@db.supa****.co:5432/postgres\nSTRIPE_SECRET_KEY=sk_live_51Hx****...****e4Rk\nOPENAI_API_KEY=sk-proj-****...****',
    explanation: 'Your .env file is accessible to anyone on the internet, exposing database credentials, API keys, and other secrets.',
    impact: 'Full access to your database, Stripe account, and OpenAI billing. All secrets are compromised simultaneously.',
    fixManual: JSON.stringify([
      'Block access to /.env immediately via your hosting platform.',
      'Rotate ALL keys listed in the file — every one is compromised.',
      'Move environment variables to Vercel Settings → Environment Variables.',
      'Add .env to .gitignore if not already there.',
    ]),
    fixAiPrompt: 'My .env file is publicly accessible. Prevent .env from being served in my Vercel deployment, migrate all secrets to Vercel environment variables, and update my code to read from process.env.',
  },
  {
    moduleId: 'P1-02', severity: 'HIGH', category: 'Sourcemap Exposure',
    title: 'Production sourcemaps expose full source code',
    location: '/assets/index-3f7a2c.js.map',
    evidence: '{"version":3,"sources":["../../src/components/Auth.tsx","../../src/lib/stripe.ts",...]}',
    explanation: 'Production sourcemap files reveal your complete original source code, including file structure, component names, and business logic.',
    impact: 'Attackers can read your source code to find additional vulnerabilities and understand your authentication logic.',
    fixManual: JSON.stringify(['Set productionBrowserSourceMaps: false in next.config.js', 'Redeploy after making the change.']),
    fixAiPrompt: 'My production build serves .map files exposing full source code. Disable production sourcemaps in my Next.js config on Vercel.',
  },
  {
    moduleId: 'P1-05', severity: 'HIGH', category: 'Cookie & Storage Hygiene',
    title: 'JWT with role claims stored in localStorage',
    location: 'localStorage key: "supabase.auth.token"',
    evidence: 'Decoded JWT payload:\n{ "role": "authenticated", "is_premium": true,\n  "subscription_tier": "pro" }',
    explanation: 'Your auth token is in localStorage (accessible to any JS on your page) and contains subscription claims that are trusted by the client.',
    impact: 'Any XSS vulnerability exposes the token. Users could modify is_premium and subscription_tier claims to bypass your paywall.',
    fixManual: JSON.stringify([
      'Move session storage to HttpOnly cookies.',
      'Never trust client-side JWT claims for authorization.',
      'Verify subscription status server-side from your database.',
    ]),
    fixAiPrompt: 'My Supabase auth JWT is in localStorage with subscription claims (is_premium, subscription_tier). Move auth to HttpOnly cookies and check subscription status server-side in Next.js middleware.',
  },
  {
    moduleId: 'P1-07', severity: 'HIGH', category: 'CORS Misconfiguration',
    title: 'CORS reflects any origin with credentials allowed',
    location: 'API endpoint: /api/v1/user/profile',
    evidence: 'Request Origin: https://evil.example.com\nResponse: Access-Control-Allow-Origin: https://evil.example.com\nAccess-Control-Allow-Credentials: true',
    explanation: 'Your API reflects any origin in CORS headers while allowing credentials. Any website can make authenticated requests to your API on behalf of your users.',
    impact: "A malicious page could read your users' private data, modify their accounts, or perform actions on their behalf.",
    fixManual: JSON.stringify(['Configure a strict allowlist of permitted origins.', 'Never reflect the request Origin header directly.']),
    fixAiPrompt: 'My API reflects any Origin header with credentials allowed. Set up a strict CORS allowlist in my Next.js API routes that only permits my own domain.',
  },
  {
    moduleId: 'P1-13', severity: 'HIGH', category: 'Exposed Admin Interfaces',
    title: 'Admin panel accessible without authentication',
    location: '/admin',
    evidence: 'HTTP 200 — renders full admin dashboard with user management, billing controls, and database viewer.',
    explanation: 'Your admin panel is publicly accessible without any authentication.',
    impact: 'Anyone who discovers this URL can access admin features, view all user data, and modify billing.',
    fixManual: JSON.stringify([
      'Add authentication middleware to all /admin routes.',
      'Restrict access to specific admin email addresses.',
      'Add rate limiting to the admin login.',
    ]),
    fixAiPrompt: 'My /admin route is publicly accessible. Add Supabase auth middleware that checks for admin role and redirects unauthorized users to login in Next.js.',
  },
  {
    moduleId: 'P1-03', severity: 'MEDIUM', category: 'Security Headers',
    title: 'Missing Content-Security-Policy header',
    location: 'All responses',
    evidence: 'Content-Security-Policy header not present in any response.',
    explanation: 'Without CSP, an XSS vulnerability has no guardrails — injected scripts can load anything from anywhere.',
    impact: 'If any XSS vulnerability exists, attackers can load external scripts and fully compromise user sessions.',
    fixManual: JSON.stringify(['Add CSP header to your next.config.js or vercel.json.', 'Start with report-only mode to identify what would break.']),
    fixAiPrompt: 'Add a Content-Security-Policy header to my Next.js app on Vercel that allows my site to function while blocking unauthorized scripts.',
  },
  {
    moduleId: 'P1-03', severity: 'MEDIUM', category: 'Security Headers',
    title: 'Missing Strict-Transport-Security (HSTS)',
    location: 'All responses',
    evidence: 'Strict-Transport-Security header not present.',
    explanation: 'Without HSTS, users typing your domain without "https://" could be intercepted during the initial HTTP redirect.',
    impact: 'Users on public Wi-Fi could have traffic intercepted before HTTPS redirect, exposing session tokens.',
    fixManual: JSON.stringify(['Add Strict-Transport-Security: max-age=31536000; includeSubDomains header.']),
    fixAiPrompt: 'Add HSTS headers to my Next.js config on Vercel with max-age of 1 year and includeSubDomains.',
  },
  {
    moduleId: 'P1-08', severity: 'MEDIUM', category: 'Mixed Content',
    title: 'Insecure resources loaded on checkout page',
    location: '/checkout — 2 HTTP resources',
    evidence: '<img src="http://cdn.taskflow.app/badge.png">\n<script src="http://analytics.taskflow.app/track.js">',
    explanation: 'Your checkout page loads resources over unencrypted HTTP. This is especially concerning on a payment page.',
    impact: 'A man-in-the-middle could replace the insecure script with malicious code to steal payment info.',
    fixManual: JSON.stringify(['Update all resource URLs to use https://.', 'Check CDN configuration to ensure HTTPS is available.']),
    fixAiPrompt: 'My checkout page loads resources over HTTP. Find and update all http:// URLs in my checkout component to https://.',
  },
  {
    moduleId: 'P1-14', severity: 'LOW', category: 'robots.txt & Sitemap',
    title: 'robots.txt reveals internal API paths',
    location: '/robots.txt',
    evidence: 'Disallow: /internal-api/\nDisallow: /admin/\nDisallow: /api/v1/debug/',
    explanation: 'Your robots.txt advertises paths you want hidden. Attackers routinely check it for interesting endpoints.',
    impact: 'Attackers learn about internal endpoints without any effort.',
    fixManual: JSON.stringify(['Remove sensitive paths from robots.txt.', 'Secure endpoints with authentication instead of hiding them.']),
    fixAiPrompt: 'Clean up my robots.txt to not reveal sensitive paths and ensure those endpoints are protected by auth.',
  },
  {
    moduleId: 'P1-09', severity: 'INFO', category: 'Third-Party Scripts',
    title: 'React 18.2.0 — minor update available',
    location: 'Framework detection',
    evidence: 'Detected: react@18.2.0 (current stable: 18.3.1)',
    explanation: 'A slightly outdated React version. No known critical vulnerabilities, but keeping current is good practice.',
    impact: 'Minimal immediate risk.',
    fixManual: JSON.stringify(['Run npm update react react-dom.']),
    fixAiPrompt: 'Update React from 18.2.0 to latest stable and verify nothing breaks.',
  },
];

const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 25, HIGH: 10, MEDIUM: 3, LOW: 1, INFO: 0,
};

function computeGrade(findings: typeof FIXTURE_FINDINGS): { grade: string; score: number } {
  const score = findings.reduce((s, f) => s + (SEVERITY_SCORE[f.severity] ?? 0), 0);
  const grade = score === 0 ? 'A'
    : score <= 5 ? 'B'
    : score <= 20 ? 'C'
    : score <= 50 ? 'D'
    : 'F';
  return { grade, score };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runScan(scanId: string): Promise<void> {
  try {
    await prisma.scan.update({ where: { id: scanId }, data: { status: 'RUNNING' } });

    // Simulate each module
    for (let i = 0; i < MODULES.length; i++) {
      const moduleId = MODULES[i];
      await sleep(340); // mimic real detection time
      await publishEvent(scanId, 'module_complete', {
        scan_id: scanId,
        module_id: moduleId,
        findings: FIXTURE_COUNTS[moduleId] ?? 0,
        index: i,
      });
    }

    // Persist findings
    await prisma.finding.createMany({
      data: FIXTURE_FINDINGS.map((f) => ({ scanId, ...f })),
    });

    // Compute grade & summary
    const { grade, score } = computeGrade(FIXTURE_FINDINGS);
    const summary: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const f of FIXTURE_FINDINGS) summary[f.severity] = (summary[f.severity] ?? 0) + 1;

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        grade,
        score,
        stack: 'Next.js on Vercel',
        summary: JSON.stringify(summary),
        completedAt: new Date(),
      },
    });

    await publishEvent(scanId, 'scan_complete', { scan_id: scanId, grade });
  } catch (err) {
    await prisma.scan.update({ where: { id: scanId }, data: { status: 'FAILED' } }).catch(() => {});
    await publishEvent(scanId, 'scan_failed', { scan_id: scanId, error: String(err) }).catch(() => {});
    throw err;
  }
}
