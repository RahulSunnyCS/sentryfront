# Phase 6 Feature Flags — Configuration Guide

Phase 6 features (PDF export, payments, authentication, tier gating) are **completely optional** and can be independently enabled/disabled via environment variables.

This allows VibeSafe to work as:
- **Free, open-source scanner** — when all features are disabled (default)
- **Self-hosted with selective features** — enable only PDF export, or only auth
- **Full commercial product** — enable all features for paid tiers

---

## Quick Start

### Option 1: Free Scanner (Default)
No configuration needed. All Phase 6 features are disabled by default.

```bash
# Just run the app — no Phase 6 features enabled
npm run dev
```

### Option 2: Enable Individual Features

Add to your `.env` or `.env.local`:

```env
# Enable PDF export only
PDF_EXPORT_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
CLOUDFLARE_R2_ACCOUNT_ID="your-account-id"
CLOUDFLARE_R2_ACCESS_KEY_ID="your-access-key"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your-secret"
CLOUDFLARE_R2_BUCKET_NAME="vibesafe-reports"
```

### Option 3: Full Commercial Setup

```env
# Enable all Phase 6 features
FEATURE_SCAN_DIFF_ENABLED="true"
NEXT_PUBLIC_SCAN_DIFF_ENABLED="true"

PDF_EXPORT_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"

STRIPE_ENABLED="true"
NEXT_PUBLIC_STRIPE_ENABLED="true"

AUTH_ENABLED="true"
NEXT_PUBLIC_AUTH_ENABLED="true"

TIER_GATING_ENABLED="true"
NEXT_PUBLIC_TIER_GATING_ENABLED="true"

# ... plus all required credentials (see .env.example)
```

---

## Feature Reference

### 1. Scan Diff Comparison

**What it does**: Adds `GET /api/v1/scans/:id/diff/:prev_id` endpoint to compare two scans.

**Enable**:
```env
FEATURE_SCAN_DIFF_ENABLED="true"
NEXT_PUBLIC_SCAN_DIFF_ENABLED="true"
```

**Behavior when disabled**:
- API endpoint returns 404 or "feature not available"
- UI hides scan comparison buttons

**No external dependencies required.**

---

### 2. PDF Export

**What it does**: Generates PDF reports and uploads to Cloudflare R2 storage.

**Enable**:
```env
PDF_EXPORT_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
CLOUDFLARE_R2_ACCOUNT_ID="..."
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="..."
```

**Behavior when disabled**:
- UI hides "Download PDF" buttons
- API endpoint returns 404

**Dependencies**: Cloudflare R2 account (S3-compatible storage).

**White-label support**: Studio tier can inject custom logo/colors via query params.

---

### 3. Stripe Payments

**What it does**: Enables paid tiers, checkout, subscriptions, and webhooks.

**Enable**:
```env
STRIPE_ENABLED="true"
NEXT_PUBLIC_STRIPE_ENABLED="true"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

**Behavior when disabled**:
- UI hides pricing page, upgrade buttons, payment forms
- All scans are treated as free tier (if tier gating is disabled) or require auth only (if tier gating is enabled)

**Dependencies**: Stripe account.

**Tiers**: Free (1 scan/month), One-Shot ($29), Pro ($49/month), Studio ($199/month).

---

### 4. Authentication

**What it does**: User login, signup, session management.

**Enable**:
```env
AUTH_ENABLED="true"
NEXT_PUBLIC_AUTH_ENABLED="true"
AUTH_PROVIDER="supabase"  # or "nextauth"
NEXT_PUBLIC_AUTH_PROVIDER="supabase"
```

**For Supabase**:
```env
SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="eyJhb..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhb..."
SUPABASE_SERVICE_ROLE_KEY="eyJhb..."  # Server-side only
```

**For NextAuth**:
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

**Behavior when disabled**:
- UI hides login/signup buttons
- All scans are anonymous
- User tier defaults to "free" (if tier gating is enabled)

**Dependencies**: Supabase account OR NextAuth OAuth providers.

---

### 5. Tier-Based Gating

**What it does**: Restricts free tier to top 5 findings + watermark. Unlocks full report for paid users.

**Enable**:
```env
TIER_GATING_ENABLED="true"
NEXT_PUBLIC_TIER_GATING_ENABLED="true"
```

**Behavior when disabled**:
- All users see full report with all findings
- No watermarks or "upgrade to see more" messages

**Behavior when enabled**:
- If `AUTH_ENABLED=false`: all users default to free tier (top 5 findings)
- If `AUTH_ENABLED=true`: checks user session for tier, defaults to free
- If `STRIPE_ENABLED=true`: users can pay to upgrade tier

**Requires**: `AUTH_ENABLED=true` for best UX (otherwise everyone is limited to 5 findings).

---

## Usage in Code

### Server-Side (API Routes, Server Components)

```typescript
import { features, isFeatureReady } from '@/lib/features';

// Check if feature is enabled
if (!features.pdfExport) {
  return NextResponse.json({ error: 'PDF export is not enabled' }, { status: 404 });
}

// Check if feature is enabled AND configured
if (!isFeatureReady('stripe')) {
  return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
}
```

### Client-Side (React Components)

```tsx
import { clientFeatures, useFeature } from '@/lib/client-features';

function ReportActions() {
  const showPdf = useFeature('pdfExport');
  const showPayment = useFeature('stripe');
  
  return (
    <>
      {showPdf && <button>Download PDF</button>}
      {showPayment && <button>Upgrade to Pro</button>}
    </>
  );
}
```

---

## Migration Path

1. **Start simple**: Run as free scanner (no config needed)
2. **Add PDF export**: Enable `PDF_EXPORT_ENABLED` + R2 credentials
3. **Add auth**: Enable `AUTH_ENABLED` + Supabase/NextAuth
4. **Add payments**: Enable `STRIPE_ENABLED` + Stripe credentials
5. **Add gating**: Enable `TIER_GATING_ENABLED` to monetize

Each step is independent and reversible.

---

## Health Check

Visit `/api/health` to see feature status (requires implementation in Phase 6).
