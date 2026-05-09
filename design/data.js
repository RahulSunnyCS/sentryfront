// VibeSafe — Sample Scan Data

window.SCAN_MODULES = [
  { id: 'P1-01', name: 'Client-Side Secrets' },
  { id: 'P1-02', name: 'Sourcemap Exposure' },
  { id: 'P1-03', name: 'Security Headers' },
  { id: 'P1-04', name: 'TLS Configuration' },
  { id: 'P1-05', name: 'Cookie & Storage' },
  { id: 'P1-06', name: 'Sensitive Paths' },
  { id: 'P1-07', name: 'CORS Configuration' },
  { id: 'P1-08', name: 'Mixed Content' },
  { id: 'P1-09', name: 'Third-Party Scripts' },
  { id: 'P1-10', name: 'DNS & Email Security' },
  { id: 'P1-11', name: 'Subdomain Takeover' },
  { id: 'P1-12', name: 'Error Disclosure' },
  { id: 'P1-13', name: 'Admin Interfaces' },
  { id: 'P1-14', name: 'robots.txt & Sitemap' },
  { id: 'P1-15', name: 'Cache Configuration' },
];

window.ACCENT_THEMES = {
  teal:   { main: '#0D9488', light: '#CCFBF1', dark: '#0F766E' },
  indigo: { main: '#4F46E5', light: '#E0E7FF', dark: '#3730A3' },
  violet: { main: '#7C3AED', light: '#EDE9FE', dark: '#5B21B6' },
};

window.GRADE_CONFIG = {
  A: { color: '#059669', bg: '#ECFDF5', fill: 1.0,  label: 'Excellent' },
  B: { color: '#0D9488', bg: '#F0FDFA', fill: 0.82, label: 'Good' },
  C: { color: '#CA8A04', bg: '#FEFCE8', fill: 0.60, label: 'Fair' },
  D: { color: '#EA580C', bg: '#FFF7ED', fill: 0.35, label: 'Poor' },
  F: { color: '#E11D48', bg: '#FFF1F2', fill: 0.12, label: 'Failing' },
};

window.SEVERITY_CONFIG = {
  CRITICAL: { color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
  HIGH:     { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  MEDIUM:   { color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
  LOW:      { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  INFO:     { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

window.BAD_SCAN = {
  url: 'taskflow.app',
  grade: 'D',
  score: 48,
  stack: 'Next.js on Vercel',
  date: 'May 10, 2026',
  duration: '73s',
  summary: { CRITICAL: 2, HIGH: 4, MEDIUM: 3, LOW: 1, INFO: 1 },
  moduleResults: {
    'P1-01': 1, 'P1-02': 1, 'P1-03': 2, 'P1-04': 0,
    'P1-05': 1, 'P1-06': 1, 'P1-07': 1, 'P1-08': 1,
    'P1-09': 1, 'P1-10': 0, 'P1-11': 0, 'P1-12': 0,
    'P1-13': 1, 'P1-14': 1, 'P1-15': 0,
  },
  findings: [
    {
      id: 'f1', module: 'P1-01', category: 'Client-Side Secret Exposure', severity: 'CRITICAL',
      title: 'Stripe live secret key exposed in JavaScript bundle',
      location: '/assets/index-3f7a2c.js (line 1,847)',
      evidence: 'const stripeClient = new Stripe("sk_live_51Hx****...****e4Rk");',
      explanation: 'Your Stripe live secret key is hardcoded in client-side JavaScript. Unlike publishable keys (pk_live_), secret keys grant full access to your Stripe account and are visible to anyone who opens browser dev tools.',
      impact: 'An attacker could create charges, issue refunds, access customer payment data, and modify your Stripe account settings.',
      fixManual: [
        'Remove the secret key from all client-side code immediately.',
        'Create a server-side API route (e.g., /api/create-payment-intent) that uses the key.',
        'Rotate the compromised key in Stripe Dashboard → Developers → API keys.',
        'Use only the publishable key (pk_live_) in client-side code.'
      ],
      fixAiPrompt: 'I have a Stripe live secret key hardcoded in my client-side JS. Move all Stripe API calls to a server-side API route in Next.js, use only the publishable key on the client, and create a /api/create-payment-intent endpoint.'
    },
    {
      id: 'f2', module: 'P1-06', category: 'Sensitive Path Exposure', severity: 'CRITICAL',
      title: 'Environment file (.env) publicly accessible',
      location: '/.env',
      evidence: 'DATABASE_URL=postgres://taskflow:****@db.supa****.co:5432/postgres\nSTRIPE_SECRET_KEY=sk_live_51Hx****...****e4Rk\nOPENAI_API_KEY=sk-proj-****...****',
      explanation: 'Your .env file is accessible to anyone on the internet, exposing database credentials, API keys, and other secrets. This likely happened because the file was included in your deployment.',
      impact: 'Full access to your database, Stripe account, and OpenAI billing. All secrets are compromised simultaneously.',
      fixManual: [
        'Block access to /.env immediately via your hosting platform.',
        'Rotate ALL keys listed in the file — every one is compromised.',
        'Move environment variables to Vercel Settings → Environment Variables.',
        'Add .env to .gitignore if not already there.'
      ],
      fixAiPrompt: 'My .env file is publicly accessible. Prevent .env from being served in my Vercel deployment, migrate all secrets to Vercel environment variables, and update my code to read from process.env.'
    },
    {
      id: 'f3', module: 'P1-02', category: 'Sourcemap Exposure', severity: 'HIGH',
      title: 'Production sourcemaps expose full source code',
      location: '/assets/index-3f7a2c.js.map',
      evidence: '{"version":3,"sources":["../../src/components/Auth.tsx","../../src/lib/stripe.ts","../../src/api/admin.ts",...]}',
      explanation: 'Production sourcemap files reveal your complete original source code, including file structure, component names, and business logic.',
      impact: 'Attackers can read your source code to find additional vulnerabilities and understand your authentication logic.',
      fixManual: [
        'Set productionBrowserSourceMaps: false in next.config.js',
        'Redeploy after making the change.'
      ],
      fixAiPrompt: 'My production build serves .map files exposing full source code. Disable production sourcemaps in my Next.js config on Vercel.'
    },
    {
      id: 'f4', module: 'P1-05', category: 'Cookie & Storage Hygiene', severity: 'HIGH',
      title: 'JWT with role claims stored in localStorage',
      location: 'localStorage key: "supabase.auth.token"',
      evidence: 'Decoded JWT payload:\n{ "role": "authenticated", "is_premium": true,\n  "subscription_tier": "pro" }',
      explanation: 'Your auth token is in localStorage (accessible to any JS on your page) and contains subscription claims that are trusted by the client.',
      impact: 'Any XSS vulnerability exposes the token. Users could modify is_premium and subscription_tier claims to bypass your paywall.',
      fixManual: [
        'Move session storage to HttpOnly cookies.',
        'Never trust client-side JWT claims for authorization.',
        'Verify subscription status server-side from your database.'
      ],
      fixAiPrompt: 'My Supabase auth JWT is in localStorage with subscription claims (is_premium, subscription_tier). Move auth to HttpOnly cookies and check subscription status server-side in Next.js middleware.'
    },
    {
      id: 'f5', module: 'P1-07', category: 'CORS Misconfiguration', severity: 'HIGH',
      title: 'CORS reflects any origin with credentials allowed',
      location: 'API endpoint: /api/v1/user/profile',
      evidence: 'Request Origin: https://evil.example.com\nResponse: Access-Control-Allow-Origin: https://evil.example.com\nAccess-Control-Allow-Credentials: true',
      explanation: 'Your API reflects any origin in CORS headers while allowing credentials. Any website can make authenticated requests to your API on behalf of your users.',
      impact: 'A malicious page could read your users\' private data, modify their accounts, or perform actions on their behalf.',
      fixManual: [
        'Configure a strict allowlist of permitted origins.',
        'Never reflect the request Origin header directly.'
      ],
      fixAiPrompt: 'My API reflects any Origin header with credentials allowed. Set up a strict CORS allowlist in my Next.js API routes that only permits my own domain.'
    },
    {
      id: 'f6', module: 'P1-13', category: 'Exposed Admin Interfaces', severity: 'HIGH',
      title: 'Admin panel accessible without authentication',
      location: '/admin',
      evidence: 'HTTP 200 — renders full admin dashboard with user management, billing controls, and database viewer.',
      explanation: 'Your admin panel is publicly accessible without any authentication. It exposes user management, billing, and database access.',
      impact: 'Anyone who discovers this URL can access admin features, view all user data, and modify billing.',
      fixManual: [
        'Add authentication middleware to all /admin routes.',
        'Restrict access to specific admin email addresses.',
        'Add rate limiting to the admin login.'
      ],
      fixAiPrompt: 'My /admin route is publicly accessible. Add Supabase auth middleware that checks for admin role and redirects unauthorized users to login in Next.js.'
    },
    {
      id: 'f7', module: 'P1-03', category: 'Security Headers', severity: 'MEDIUM',
      title: 'Missing Content-Security-Policy header',
      location: 'All responses',
      evidence: 'Content-Security-Policy header not present in any response.',
      explanation: 'Without CSP, an XSS vulnerability has no guardrails — injected scripts can load anything from anywhere.',
      impact: 'If any XSS vulnerability exists, attackers can load external scripts and fully compromise user sessions.',
      fixManual: ['Add CSP header to your next.config.js or vercel.json.', 'Start with report-only mode to identify what would break.'],
      fixAiPrompt: 'Add a Content-Security-Policy header to my Next.js app on Vercel that allows my site to function while blocking unauthorized scripts.'
    },
    {
      id: 'f8', module: 'P1-03', category: 'Security Headers', severity: 'MEDIUM',
      title: 'Missing Strict-Transport-Security (HSTS)',
      location: 'All responses',
      evidence: 'Strict-Transport-Security header not present.',
      explanation: 'Without HSTS, users typing your domain without "https://" could be intercepted during the initial HTTP redirect.',
      impact: 'Users on public Wi-Fi could have traffic intercepted before HTTPS redirect, exposing session tokens.',
      fixManual: ['Add Strict-Transport-Security: max-age=31536000; includeSubDomains header.'],
      fixAiPrompt: 'Add HSTS headers to my Next.js config on Vercel with max-age of 1 year and includeSubDomains.'
    },
    {
      id: 'f9', module: 'P1-08', category: 'Mixed Content', severity: 'MEDIUM',
      title: 'Insecure resources loaded on checkout page',
      location: '/checkout — 2 HTTP resources',
      evidence: '<img src="http://cdn.taskflow.app/badge.png">\n<script src="http://analytics.taskflow.app/track.js">',
      explanation: 'Your checkout page loads resources over unencrypted HTTP. This is especially concerning on a payment page.',
      impact: 'A man-in-the-middle could replace the insecure script with malicious code to steal payment info.',
      fixManual: ['Update all resource URLs to use https://.', 'Check CDN configuration to ensure HTTPS is available.'],
      fixAiPrompt: 'My checkout page loads resources over HTTP. Find and update all http:// URLs in my checkout component to https://.'
    },
    {
      id: 'f10', module: 'P1-14', category: 'robots.txt & Sitemap', severity: 'LOW',
      title: 'robots.txt reveals internal API paths',
      location: '/robots.txt',
      evidence: 'Disallow: /internal-api/\nDisallow: /admin/\nDisallow: /api/v1/debug/',
      explanation: 'Your robots.txt advertises paths you want hidden. Attackers routinely check it for interesting endpoints.',
      impact: 'Attackers learn about internal endpoints without any effort.',
      fixManual: ['Remove sensitive paths from robots.txt.', 'Secure endpoints with authentication instead of hiding them.'],
      fixAiPrompt: 'Clean up my robots.txt to not reveal sensitive paths and ensure those endpoints are protected by auth.'
    },
    {
      id: 'f11', module: 'P1-09', category: 'Third-Party Scripts', severity: 'INFO',
      title: 'React 18.2.0 — minor update available',
      location: 'Framework detection',
      evidence: 'Detected: react@18.2.0 (current stable: 18.3.1)',
      explanation: 'A slightly outdated React version. No known critical vulnerabilities, but keeping current is good practice.',
      impact: 'Minimal immediate risk.',
      fixManual: ['Run npm update react react-dom.'],
      fixAiPrompt: 'Update React from 18.2.0 to latest stable and verify nothing breaks.'
    }
  ]
};

window.GOOD_SCAN = {
  url: 'portfoliokit.design',
  grade: 'B',
  score: 7,
  stack: 'Vite + React on Netlify',
  date: 'May 10, 2026',
  duration: '61s',
  summary: { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 1, INFO: 1 },
  moduleResults: {
    'P1-01': 0, 'P1-02': 0, 'P1-03': 2, 'P1-04': 0,
    'P1-05': 0, 'P1-06': 0, 'P1-07': 0, 'P1-08': 0,
    'P1-09': 1, 'P1-10': 0, 'P1-11': 0, 'P1-12': 0,
    'P1-13': 0, 'P1-14': 0, 'P1-15': 1,
  },
  findings: [
    {
      id: 'g1', module: 'P1-03', severity: 'MEDIUM', category: 'Security Headers',
      title: 'Missing Content-Security-Policy header',
      location: 'All responses',
      evidence: 'Content-Security-Policy header not present.',
      explanation: 'No CSP header. While no active vulnerabilities exist, CSP provides defense-in-depth against future XSS.',
      impact: 'No browser-level guardrails if an XSS vulnerability is ever introduced.',
      fixManual: ['Add CSP via Netlify _headers file or netlify.toml.'],
      fixAiPrompt: 'Add a Content-Security-Policy header to my Netlify deployment with Vite + React.'
    },
    {
      id: 'g2', module: 'P1-03', severity: 'MEDIUM', category: 'Security Headers',
      title: 'Permissive Referrer-Policy',
      location: 'All responses',
      evidence: 'Referrer-Policy: no-referrer-when-downgrade (browser default)',
      explanation: 'Full URL is sent to external sites when users click links, potentially leaking private page paths.',
      impact: 'External sites can see the full URL your users came from.',
      fixManual: ['Set Referrer-Policy: strict-origin-when-cross-origin.'],
      fixAiPrompt: 'Set Referrer-Policy to strict-origin-when-cross-origin in my Netlify headers.'
    },
    {
      id: 'g3', module: 'P1-09', severity: 'LOW', category: 'Third-Party Scripts',
      title: 'CDN scripts without Subresource Integrity',
      location: '3 external scripts',
      evidence: '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"> (no integrity attribute)',
      explanation: 'External scripts loaded without SRI hashes. If the CDN is compromised, tampered scripts run on your site.',
      impact: 'Low probability but high impact if a CDN is compromised.',
      fixManual: ['Add integrity attributes to all CDN script tags.'],
      fixAiPrompt: 'Add SRI hashes to all external CDN script tags in my project.'
    },
    {
      id: 'g4', module: 'P1-15', severity: 'INFO', category: 'Cache Configuration',
      title: 'Server header exposes nginx version',
      location: 'All responses',
      evidence: 'Server: nginx/1.24.0',
      explanation: 'Server version is advertised, making it easier for attackers to find version-specific vulnerabilities.',
      impact: 'Simplifies reconnaissance for potential attackers.',
      fixManual: ['Set server_tokens off in nginx config.'],
      fixAiPrompt: 'Hide nginx version from server headers by setting server_tokens off.'
    }
  ]
};
