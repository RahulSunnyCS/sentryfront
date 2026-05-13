# Technical Design Document (TDD)

**Product:** VibeSafe - Web Quality Scanner  
**Version:** 2.0  
**Last Updated:** 2026-05-13  
**Status:** Active Development

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────┐         │
│  │ Web App  │  │  Extension  │  │  Mobile App    │         │
│  │ Next.js  │  │  (Chrome)   │  │  (React Native)│         │
│  └────┬─────┘  └──────┬──────┘  └────────┬───────┘         │
│       │               │                   │                  │
└───────┼───────────────┼───────────────────┼──────────────────┘
        │               │                   │
        │               │                   │
┌───────▼───────────────▼───────────────────▼──────────────────┐
│                      API Layer (Next.js)                      │
├───────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/v1/scans           - Create & retrieve scans          │
│  /api/v1/auth            - Authentication (NextAuth)        │
│  /api/v1/billing         - Stripe webhooks                  │
│  /api/v1/extension       - Chrome extension endpoints       │
│                                                              │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│                     Business Logic Layer                      │
├───────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Scanner    │  │  AI Enrichment│ │   Billing    │      │
│  │   Engine     │  │  (Claude API) │ │   (Stripe)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────┐
│                      Data Layer                               │
├───────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │  Cloudflare  │      │
│  │  (Neon/      │  │  (Upstash)   │  │     R2       │      │
│  │   Supabase)  │  │  (Caching)   │  │  (PDF Storage)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
└───────────────────────────────────────────────────────────────┘
```

---

### 1.2 Technology Stack

**Frontend:**
- Framework: Next.js 14 (App Router)
- Language: TypeScript 5.3+
- Styling: Tailwind CSS 3.4
- UI Components: Headless UI
- State: React Context + Server Components
- Forms: React Hook Form + Zod

**Backend:**
- Runtime: Node.js 18+ (Vercel Serverless)
- API: Next.js API Routes (REST)
- Auth: NextAuth.js 4.x
- ORM: Prisma 5.x
- Validation: Zod

**Database:**
- Primary: PostgreSQL 15+ (Neon)
- Cache: Redis (Upstash)
- Queue: BullMQ (optional, for background jobs)

**External Services:**
- AI: Anthropic Claude Sonnet 4
- Payments: Stripe
- Storage: Cloudflare R2 (S3-compatible)
- Monitoring: Sentry
- Analytics: Plausible (privacy-first)

**DevOps:**
- Hosting: Vercel
- CI/CD: GitHub Actions
- DNS: Cloudflare
- SSL: Automatic (Vercel)

---

## 2. Database Schema

### 2.1 ERD (Entity Relationship Diagram)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │───┐   │    Scan     │───┐   │   Finding   │
├─────────────┤   │   ├─────────────┤   │   ├─────────────┤
│ id          │   └──▶│ id          │   └──▶│ id          │
│ email       │       │ userId      │       │ scanId      │
│ name        │       │ targetUrl   │       │ moduleId    │
│ tier        │       │ status      │       │ severity    │
│ stripeId    │       │ grade       │       │ title       │
│ createdAt   │       │ score       │       │ location    │
└─────────────┘       │ findings    │       │ evidence    │
                      │ createdAt   │       │ explanation │
                      └─────────────┘       └─────────────┘
                            │
                            │
                      ┌─────▼───────┐
                      │  ScanEvent  │
                      ├─────────────┤
                      │ id          │
                      │ scanId      │
                      │ eventType   │
                      │ payload     │
                      │ createdAt   │
                      └─────────────┘
```

---

### 2.2 Prisma Schema

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// User model (NextAuth)
model User {
  id               String   @id @default(cuid())
  name             String?
  email            String?  @unique
  emailVerified    DateTime?
  image            String?
  tier             String   @default("free") // free, pro, team, business
  stripeCustomerId String?
  createdAt        DateTime @default(now())

  accounts Account[]
  sessions Session[]
  scans    Scan[]
}

// NextAuth models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Scan model
model Scan {
  id          String    @id @default(cuid())
  userId      String?
  targetUrl   String
  status      String    @default("QUEUED") // QUEUED, RUNNING, COMPLETED, FAILED
  tier        String    @default("free")
  
  // Results
  grade       String?   // A, B, C, D, F
  score       Float?    // 0-100
  stack       String?   // Detected tech stack
  summary     String?   // JSON: {"CRITICAL": 2, "HIGH": 5, ...}
  
  // Performance results
  performanceGrade   String?
  performanceScore   Float?
  performanceMetrics String? // JSON
  
  // Accessibility results
  accessibilityGrade   String?
  accessibilityScore   Float?
  accessibilityMetrics String? // JSON
  
  // SEO results
  seoGrade   String?
  seoScore   Float?
  seoMetrics String? // JSON
  
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  requesterIp String?

  user     User?       @relation(fields: [userId], references: [id])
  findings Finding[]
  events   ScanEvent[]
  
  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

// Finding model
model Finding {
  id          String @id @default(cuid())
  scanId      String
  moduleId    String // P1-01, P1-02, etc.
  severity    String // CRITICAL, HIGH, MEDIUM, LOW, INFO
  category    String // Security, Performance, Accessibility, SEO
  title       String
  location    String
  evidence    String
  explanation String // AI-generated
  impact      String
  fixManual   String // JSON array
  fixAiPrompt String

  scan Scan @relation(fields: [scanId], references: [id], onDelete: Cascade)
  
  @@index([scanId])
  @@index([severity])
}

// ScanEvent model (for SSE streaming)
model ScanEvent {
  id        Int      @id @default(autoincrement())
  scanId    String
  eventType String   // module_complete, llm_started, etc.
  payload   String   // JSON
  createdAt DateTime @default(now())

  scan Scan @relation(fields: [scanId], references: [id], onDelete: Cascade)

  @@index([scanId])
}
```

---

## 3. API Specification

### 3.1 REST API Endpoints

**Base URL:** `https://vibesafe.app/api/v1`

#### POST /scans
Create a new scan

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "enableAI": true,
    "modules": ["security", "performance"] // optional
  }
}
```

**Response:** (201 Created)
```json
{
  "id": "scan_abc123",
  "status": "QUEUED",
  "targetUrl": "https://example.com",
  "createdAt": "2026-05-13T10:00:00Z"
}
```

---

#### GET /scans/:id
Get scan status and results

**Response:** (200 OK)
```json
{
  "id": "scan_abc123",
  "status": "COMPLETED",
  "targetUrl": "https://example.com",
  "grade": "B",
  "score": 85,
  "summary": {
    "CRITICAL": 0,
    "HIGH": 2,
    "MEDIUM": 5,
    "LOW": 3,
    "INFO": 1
  },
  "completedAt": "2026-05-13T10:00:30Z"
}
```

---

#### GET /scans/:id/findings
Get detailed findings

**Response:** (200 OK)
```json
{
  "findings": [
    {
      "id": "finding_xyz",
      "moduleId": "P1-03",
      "severity": "HIGH",
      "category": "Security",
      "title": "Missing Content-Security-Policy header",
      "location": "HTTP Response Headers",
      "evidence": "No CSP header found",
      "explanation": "Your site is vulnerable to XSS attacks...",
      "impact": "Attackers can inject malicious scripts...",
      "fixManual": [
        "Add CSP header to your server config",
        "In Next.js: use next.config.js headers"
      ],
      "fixAiPrompt": "Add Content-Security-Policy header..."
    }
  ]
}
```

---

#### GET /scans/:id/stream
Server-Sent Events (SSE) for real-time progress

**Response:** (text/event-stream)
```
event: module_complete
data: {"moduleId": "P1-01", "findingsCount": 0}

event: module_complete  
data: {"moduleId": "P1-02", "findingsCount": 1}

event: scan_complete
data: {"grade": "B", "score": 85}
```

---

### 3.2 Authentication

**Method:** NextAuth.js with OAuth providers

**Supported Providers:**
- GitHub OAuth
- Google OAuth
- Email/Password (future)

**JWT Structure:**
```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "tier": "pro",
  "iat": 1715601600,
  "exp": 1718193600
}
```

**Protected Endpoints:**
- All endpoints under `/api/v1/*` require authentication
- Except: `POST /scans` (limited to 10/day without auth)

---

### 3.3 Rate Limiting

**By Tier:**

| Tier | Scans/Month | Scans/Day | API Rate |\n|------|-------------|-----------|----------|\n| Free | 10 | 2 | 10 req/min |\n| Pro | 100 | 10 | 60 req/min |\n| Team | 500 | 50 | 120 req/min |\n| Business | 2,500 | 250 | 300 req/min |

**Implementation:**
- Redis-based token bucket algorithm
- HTTP 429 response when exceeded
- `X-RateLimit-*` headers in response

---

## 4. Scanning Engine Architecture

### 4.1 Scanner Flow

```
1. Receive URL from API
   ↓
2. Validate URL (security checks)
   ↓
3. Fetch HTML + Headers
   ↓
4. Run Security Modules (parallel)
   ├─ P1-01: Client-side secrets
   ├─ P1-02: Source maps
   ├─ P1-03: Security headers
   ├─ ... (15 total)
   ↓
5. Run Performance Modules (parallel)
   ├─ P2-01: Core Web Vitals
   ├─ P2-02: Resource optimization
   ├─ ... (6 total)
   ↓
6. Run Accessibility Modules (parallel)
   ├─ P3-01: Color contrast
   ├─ P3-02: Keyboard navigation
   ├─ ... (5 total)
   ↓
7. Run SEO Modules (parallel)
   ├─ P4-01: Meta tags
   ├─ P4-02: Social metadata
   ├─ ... (5 total)
   ↓
8. Calculate scores + grades
   ↓
9. (Optional) AI enrichment
   ↓
10. Save to database
   ↓
11. Return results
```

---

### 4.2 Module Interface

**Every module implements:**

```typescript
interface ScanModule {
  id: string;           // "P1-01"
  name: string;         // "Client-Side Secrets"
  category: string;     // "Security"

  run(context: ScanContext): Promise<ModuleResult>;
}

interface ScanContext {
  url: string;
  html: string;
  headers: Record<string, string>;
  resources: Resource[];
  dom?: JSDOM;
}

interface ModuleResult {
  moduleId: string;
  passed: boolean;
  findings: Finding[];
  metadata?: Record<string, any>;
}

interface Finding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  location: string;
  evidence: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;
}
```

---

### 4.3 Example Module: P1-01 (Client-Side Secrets)

```typescript
// src/lib/scanner/modules/security/p1-01-secrets.ts

export const ClientSideSecretsModule: ScanModule = {
  id: "P1-01",
  name: "Client-Side Secrets Detection",
  category: "Security",

  async run(context: ScanContext): Promise<ModuleResult> {
    const findings: Finding[] = [];

    // Regex patterns for secrets
    const patterns = [
      { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
      { name: "Stripe Secret Key", regex: /sk_live_[0-9a-zA-Z]{24}/ },
      { name: "GitHub Token", regex: /gh[pousr]_[0-9a-zA-Z]{36}/ },
      // ... 700+ patterns
    ];

    // Search in HTML, JS bundles, source maps
    for (const pattern of patterns) {
      const matches = context.html.match(pattern.regex);

      if (matches) {
        findings.push({
          severity: "CRITICAL",
          title: `Exposed ${pattern.name} in client-side code`,
          location: "HTML/JavaScript Bundle",
          evidence: matches[0].substring(0, 20) + "...",
          impact: "Attackers can use this key to access your services",
          fixManual: [
            "Move this key to environment variables",
            "Rotate the exposed key immediately",
            "Use server-side API calls instead"
          ],
          fixAiPrompt: `Remove ${pattern.name} from client code and use server-side environment variable`
        });
      }
    }

    return {
      moduleId: "P1-01",
      passed: findings.length === 0,
      findings
    };
  }
};
```

---

## 5. AI Enrichment System

### 5.1 Architecture

**Purpose:** Add plain-English explanations to findings

**Flow:**
```
1. Scan completes (raw findings)
   ↓
2. For each finding with severity >= MEDIUM:
   ↓
3. Build prompt:
   - Finding details
   - Detected tech stack
   - Business context
   ↓
4. Call Claude Sonnet 4 API
   ↓
5. Parse response (explanation + enhanced fix)
   ↓
6. Update finding in database
```

---

### 5.2 Prompt Template

```typescript
const buildPrompt = (finding: Finding, techStack: string[]) => `
You are a security expert explaining a web security issue to a developer.

**Issue:** ${finding.title}
**Severity:** ${finding.severity}
**Evidence:** ${finding.evidence}
**Tech Stack:** ${techStack.join(", ")}

Provide:
1. Plain-English explanation (2-3 sentences)
2. Business impact (1 sentence)
3. AI coding tool fix prompt (1 paragraph)

Keep it concise and actionable.
`;
```

**Example Response:**
```
Your website is missing the Content-Security-Policy header, which tells browsers
what scripts are allowed to run. Without it, attackers can inject malicious
JavaScript that steals user data or performs actions on their behalf.

This could lead to account takeovers, data theft, or reputation damage if users
are compromised.

Add this to your Next.js next.config.js:
"Add a Content-Security-Policy header in next.config.js with these directives:
default-src 'self'; script-src 'self' https://trusted-cdn.com; ..."
```

---

### 5.3 Cost Optimization

**Strategies:**
1. Only enrich HIGH/CRITICAL findings (70% cost reduction)
2. Cache explanations by finding type (90% reduction after warmup)
3. Batch API calls (reduce latency)
4. Opt-out for free tier

**Cost Estimate:**
- Average findings per scan: 10
- Findings enriched: 3 (CRITICAL + HIGH only)
- Cost per finding: $0.0005
- Cost per scan: $0.0015

---

## 6. Chrome Extension Architecture

### 6.1 Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "VibeSafe Scanner",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "storage",
    "webRequest"
  ],
  "host_permissions": [
    "https://vibesafe.app/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html"
  }
}
```

---

### 6.2 Data Flow

```
1. User navigates to site (logged in)
   ↓
2. Clicks extension → "Start Recording"
   ↓
3. Content script monitors:
   - DOM snapshots
   - Network requests
   - Console errors
   - JavaScript errors
   ↓
4. User navigates to 2-5 pages
   ↓
5. Clicks "Stop & Analyze"
   ↓
6. Background worker:
   - Collects data from content scripts
   - Sends to VibeSafe API (authenticated)
   ↓
7. Server analyzes (same modules as URL scan)
   ↓
8. Results displayed in popup or new tab
```

---

### 6.3 Privacy & Security

**Data Collection:**
- Only collect HTML, headers, JS errors
- NO form data, passwords, cookies sent to server
- Data encrypted in transit (HTTPS)
- Data deleted after scan

**User Control:**
- Explicit "Start Recording" action
- Visual indicator when recording
- Clear data deletion policy

---

## 7. Deployment Architecture

### 7.1 Vercel Deployment

**Configuration:**
```json
{
  "framework": "nextjs",
  "buildCommand": "prisma generate && next build",
  "regions": ["iad1", "sfo1", "lhr1"],
  "env": {
    "DATABASE_URL": "@vibesafe-db-url",
    "ANTHROPIC_API_KEY": "@anthropic-key",
    "STRIPE_SECRET_KEY": "@stripe-secret"
  }
}
```

**Edge Functions:**
- `/api/v1/scans` → Edge runtime (fast global response)
- Scanner workers → Node.js runtime (CPU-intensive)

---

### 7.2 Database (Neon PostgreSQL)

**Configuration:**
- Plan: Pro ($19/month)
- Region: US East (primary)
- Read replicas: EU, Asia (future)
- Autoscaling: 0.5 - 4 compute units
- Storage: 10GB (sufficient for Year 1)

**Backup Strategy:**
- Neon automatic backups (7 days)
- Weekly manual backups to S3
- Point-in-time recovery available

---

### 7.3 Caching Strategy

**Redis (Upstash):**
```typescript
// Cache scan results for 24 hours
const cacheKey = `scan:${url}`;
const ttl = 60 * 60 * 24; // 24 hours

// Check cache first
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Run scan
const result = await runScan(url);

// Cache result
await redis.setex(cacheKey, ttl, JSON.stringify(result));
```

**CDN (Cloudflare):**
- Static assets: 1 year cache
- API responses: No cache (auth required)
- PDF reports: 7 days cache

---

## 8. Security Considerations

### 8.1 Input Validation

**URL Sanitization:**
```typescript
const validateUrl = (input: string): URL | null => {
  // Block local/private IPs
  const blockedPatterns = [
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
    /^https?:\/\/192\.168\./,
    /^https?:\/\/10\./,
    /^https?:\/\/169\.254\./, // AWS metadata
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(input)) {
      throw new Error("Cannot scan local/private URLs");
    }
  }

  return new URL(input); // Throws if invalid
};
```

---

### 8.2 Secrets Management

**Environment Variables:**
- Store in Vercel Environment Variables (encrypted)
- Rotate every 90 days
- Use separate keys for dev/staging/production

**Never Log:**
- API keys
- Database credentials
- User emails (hash instead)
- Scan URLs (PII risk)

---

### 8.3 GDPR/CCPA Compliance

**Data Retention:**
- Scan results: 90 days (configurable)
- User accounts: Indefinite (until deletion request)
- Logs: 30 days

**User Rights:**
- Right to access: `/api/v1/users/me/data`
- Right to deletion: `/api/v1/users/me/delete`
- Right to export: PDF/JSON download

---

## 9. Monitoring & Observability

### 9.1 Error Tracking (Sentry)

**Capture:**
- All uncaught exceptions
- API errors (5xx)
- Scan failures
- Payment failures

**Alerts:**
- Error rate > 1% → Slack notification
- Payment failures → Email immediately
- Scan timeout > 60s → Log warning

---

### 9.2 Performance Monitoring

**Metrics:**
- API response time (p50, p95, p99)
- Scan duration (by module)
- Database query time
- AI API latency

**Tools:**
- Vercel Analytics (built-in)
- Sentry Performance
- Prisma query logging

---

### 9.3 Business Metrics

**Track:**
- Daily active users (DAU)
- Scans per day
- Conversion rate (free → paid)
- Churn rate
- MRR growth

**Dashboard:** Plausible Analytics + custom admin panel

---

## 10. Scalability Plan

### 10.1 Current Capacity (Year 1)

**Limits:**
- 10,000 scans/day
- 1,000 concurrent users
- 100GB database storage
- $500/month infrastructure

**Bottlenecks:**
- Scanner is CPU-bound (single-threaded)
- Database write throughput
- AI API rate limits

---

### 10.2 Scaling Strategy

**Phase 1: Vertical (0-10K users)**
- Upgrade Neon compute units (0.5 → 4)
- Add Redis caching
- Optimize slow SQL queries

**Phase 2: Horizontal (10K-100K users)**
- Queue system (BullMQ) for scans
- Separate worker nodes (Render.com)
- Database read replicas
- CDN for all static assets

**Phase 3: Multi-region (100K+ users)**
- Deploy to multiple regions
- Geo-distributed database
- Multi-cloud (AWS + Vercel)

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Coverage Target:** 80%+

**Test Each Module:**
```typescript
describe("P1-01: Client-Side Secrets", () => {
  it("should detect AWS access keys", () => {
    const html = '<script>const key = "AKIAIOSFODNN7EXAMPLE"</script>';
    const result = await module.run({ html, ... });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("CRITICAL");
  });

  it("should not flag commented-out keys", () => {
    const html = '<!-- AKIAIOSFODNN7EXAMPLE -->';
    const result = await module.run({ html, ... });

    expect(result.findings).toHaveLength(0);
  });
});
```

---

### 11.2 Integration Tests

**End-to-End Scan:**
```typescript
describe("Full Scan Flow", () => {
  it("should complete scan in <60s", async () => {
    const response = await POST("/api/v1/scans", {
      url: "https://example.com"
    });

    expect(response.status).toBe(201);

    const scanId = response.data.id;

    // Poll for completion
    const result = await waitForScan(scanId, 60_000);

    expect(result.status).toBe("COMPLETED");
    expect(result.grade).toMatch(/^[A-F]$/);
  });
});
```

---

### 11.3 Performance Tests

**Load Testing:**
- Tool: k6.io
- Target: 100 concurrent scans
- Duration: 5 minutes
- Success criteria: p95 < 60s

---

## 12. Future Enhancements

### 12.1 Planned Features (Q2-Q4 2026)

1. **GitHub Action**
   - Run scans on every PR
   - Comment with results
   - Block merge if grade < C

2. **API v2**
   - GraphQL support
   - Webhooks for scan completion
   - Bulk scanning

3. **Mobile App (React Native)**
   - Scan from mobile
   - View history
   - Push notifications for scan completion

4. **Custom Rules Engine**
   - User-defined regex patterns
   - Custom severity levels
   - White-labeling for agencies

---

## 13. Appendix

### 13.1 Tech Stack Comparison

**Why Next.js over alternatives?**

| Framework | Pros | Cons | Decision |
|-----------|------|------|----------|
| Next.js | Vercel-optimized, great DX | Vendor lock-in | ✅ Chosen |
| SvelteKit | Smaller bundles | Smaller ecosystem | ❌ |
| Remix | Excellent UX patterns | Newer, less tooling | ❌ |

---

### 13.2 Database Design Decisions

**Why PostgreSQL over MongoDB?**
- Relational data (users → scans → findings)
- ACID compliance required (billing)
- Better tooling (Prisma, pgAdmin)
- Easier to query (SQL vs aggregation pipelines)

---

### 13.3 Cost Projections (Year 1)

**Monthly Costs:**
```
Vercel Pro:              $20
Neon DB:                 $19
Upstash Redis:           $10
Cloudflare R2:           $5
Anthropic API:           $150 (1,000 scans/day)
Stripe fees:             ~$100 (at $5K MRR)
Sentry:                  $0 (free tier)
-----------------------------------
Total:                   ~$304/month
```

**At $25K MRR:** Margin = 98.8% 🎉

---

**Document Owner:** Engineering Team
**Next Review:** 2026-06-01
**Feedback:** File issues in GitHub or email tech@vibesafe.app
