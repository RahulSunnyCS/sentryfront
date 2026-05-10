# 🎛️ VibeSafe Feature Configuration Guide

Step-by-step guide to enable optional features in VibeSafe.

**All features are disabled by default.** Enable only what you need!

---

## 📋 Quick Reference

| Feature | Recommended For | Cost | Setup Time |
|---------|----------------|------|------------|
| **LLM Enrichment** | Everyone | ~$0.001/scan | 2 min |
| **Sentry** | Production | Free tier | 5 min |
| **Stripe** | Monetization | % of sales | 15 min |
| **NextAuth** | User accounts | Free | 10 min |
| **PDF Export** | Pro/Studio tiers | Storage costs | 15 min |
| **Tier Gating** | With Stripe | Free | 2 min |
| **Scan Diff** | Pro tier | Free | 2 min |

---

## 🤖 Feature 1: LLM Enrichment (Recommended)

**What it does:** Adds AI-powered explanations and fix prompts to findings.

**Why enable it:** Makes reports 10x more useful with plain-English impact analysis.

### Setup (2 minutes)

1. **Get Anthropic API Key**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Create account (free trial: $5 credit)
   - Copy API key

2. **Add to `.env`**
   ```bash
   ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxx"
   LLM_ENRICHMENT_ENABLED="true"
   ```

3. **Restart server**
   ```bash
   npm run dev
   ```

4. **Test**
   - Run a scan
   - Findings should have detailed explanations
   - Check for "AI fix prompt" sections

**Cost:** ~$0.001 per scan (40 findings × Claude Sonnet 4 pricing)

---

## 🔍 Feature 2: Sentry Error Tracking (Highly Recommended)

**What it does:** Automatically tracks errors, crashes, and performance issues.

**Why enable it:** Catch bugs before users report them.

### Setup (5 minutes)

1. **Create Sentry Account**
   - Go to [sentry.io](https://sentry.io)
   - Sign up (free tier: 5k errors/month)
   - Create new project → Select "Next.js"

2. **Copy DSN**
   - Project Settings → Client Keys (DSN)
   - Copy the DSN URL

3. **Add to `.env`**
   ```bash
   SENTRY_ENABLED="true"
   SENTRY_DSN="https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxx"
   
   # For browser-side errors
   NEXT_PUBLIC_SENTRY_ENABLED="true"
   NEXT_PUBLIC_SENTRY_DSN="https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxx"
   ```

4. **Restart & Test**
   ```bash
   npm run dev
   ```
   
   Trigger a test error:
   ```bash
   curl http://localhost:3001/api/v1/scans/invalid-id
   ```
   
   Check Sentry dashboard for the error!

**Cost:** Free for up to 5,000 errors/month

---

## 💳 Feature 3: Stripe Payments

**What it does:** Enables paid tiers (One-Shot, Pro, Studio).

**Why enable it:** Monetize your scanner.

### Setup (15 minutes)

1. **Create Stripe Account**
   - Go to [dashboard.stripe.com](https://dashboard.stripe.com)
   - Sign up and complete onboarding

2. **Create Products**
   
   In Stripe Dashboard → Products:
   
   **Product 1: One-Shot Scan**
   - Name: "One-Shot Security Scan"
   - Price: $29 (one-time payment)
   - Copy Price ID: `price_xxxxxxxxxxxxx`
   
   **Product 2: Pro (Monthly)**
   - Name: "Pro Plan"
   - Price: $49/month (recurring)
   - Copy Price ID: `price_xxxxxxxxxxxxx`
   
   **Product 3: Studio (Monthly)**
   - Name: "Studio Plan"
   - Price: $199/month (recurring)
   - Copy Price ID: `price_xxxxxxxxxxxxx`

3. **Get API Keys**
   - Developers → API Keys
   - Copy "Secret key" (starts with `sk_test_` or `sk_live_`)
   - Copy "Publishable key" (starts with `pk_test_` or `pk_live_`)

4. **Add to `.env`**
   ```bash
   STRIPE_ENABLED="true"
   STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxx"
   STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxx"
   NEXT_PUBLIC_STRIPE_ENABLED="true"
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxx"
   
   # Product Price IDs
   STRIPE_PRICE_ID_ONE_SHOT="price_xxxxxxxxxxxxx"
   STRIPE_PRICE_ID_PRO_MONTHLY="price_xxxxxxxxxxxxx"
   STRIPE_PRICE_ID_STUDIO_MONTHLY="price_xxxxxxxxxxxxx"
   ```

5. **Set Up Webhook** (Production only)
   - Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events to send:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy webhook signing secret
   
   Add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"
   ```

6. **Test**
   - Restart server
   - Pricing UI should appear
   - Test checkout (use test card: `4242 4242 4242 4242`)

**Cost:** Stripe fees (2.9% + $0.30 per transaction)

---

## 🔐 Feature 4: NextAuth (User Authentication)

**What it does:** Enables user accounts with GitHub/Google login.

**Why enable it:** Required for Stripe, tier tracking, and scan history.

### Setup (10 minutes)

1. **Generate Secret**
   ```bash
   openssl rand -base64 32
   # Copy the output
   ```

2. **Set Up GitHub OAuth**
   - Go to GitHub → Settings → Developer settings → OAuth Apps
   - New OAuth App
   - Application name: "VibeSafe"
   - Homepage URL: `http://localhost:3001` (dev) or your domain (prod)
   - Callback URL: `http://localhost:3001/api/auth/callback/github`
   - Copy Client ID and Client Secret

3. **Set Up Google OAuth** (Optional)
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create project → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/api/auth/callback/google`
   - Copy Client ID and Client Secret

4. **Add to `.env`**
   ```bash
   AUTH_ENABLED="true"
   AUTH_PROVIDER="nextauth"
   NEXTAUTH_URL="http://localhost:3001"
   NEXTAUTH_SECRET="<paste-generated-secret>"
   
   NEXT_PUBLIC_AUTH_ENABLED="true"
   NEXT_PUBLIC_AUTH_PROVIDER="nextauth"
   
   # GitHub
   GITHUB_ID="xxxxxxxxxxxxx"
   GITHUB_SECRET="xxxxxxxxxxxxx"
   
   # Google (optional)
   GOOGLE_CLIENT_ID="xxxxxxxxxxxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="xxxxxxxxxxxxx"
   ```

5. **Update Database Schema**
   
   NextAuth requires additional tables. Add to `prisma/schema.prisma` if not already present:
   ```prisma
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
     user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@unique([provider, providerAccountId])
   }
   
   model Session {
     id           String   @id @default(cuid())
     sessionToken String   @unique
     userId       String
     expires      DateTime
     user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   
   model VerificationToken {
     identifier String
     token      String   @unique
     expires    DateTime
     @@unique([identifier, token])
   }
   ```
   
   Then run:
   ```bash
   npx prisma migrate dev --name add_nextauth_tables
   ```

6. **Test**
   - Restart server
   - "Sign in" button should appear in nav
   - Click and test GitHub login

---

## 📄 Feature 5: PDF Export

**What it does:** Generates downloadable PDF reports.

**Why enable it:** Premium feature for Pro/Studio tiers.

### Setup (15 minutes)

1. **Create Cloudflare R2 Bucket**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - R2 → Create bucket
   - Name: `vibesafe-pdfs`
   - Copy Account ID

2. **Create API Token**
   - R2 → Manage R2 API Tokens
   - Create API token with R2 read/write permissions
   - Copy Access Key ID and Secret Access Key

3. **Add to `.env`**
   ```bash
   PDF_EXPORT_ENABLED="true"
   NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
   
   CLOUDFLARE_R2_ACCOUNT_ID="xxxxxxxxxxxxx"
   CLOUDFLARE_R2_ACCESS_KEY_ID="xxxxxxxxxxxxx"
   CLOUDFLARE_R2_SECRET_ACCESS_KEY="xxxxxxxxxxxxx"
   CLOUDFLARE_R2_BUCKET_NAME="vibesafe-pdfs"
   ```

4. **Test**
   - Restart server
   - "Export PDF" button should appear on reports
   - Click to generate and download PDF

**Cost:** $0.015/GB storage + $0.36/million requests (free tier: 10GB)

---

## 🎚️ Feature 6: Tier Gating

**What it does:** Limits free users to top 5 findings, shows upgrade prompts.

**Why enable it:** Encourages upgrades to paid tiers.

### Setup (2 minutes)

Simply add to `.env`:
```bash
TIER_GATING_ENABLED="true"
NEXT_PUBLIC_TIER_GATING_ENABLED="true"
```

**Requires:** Stripe + Auth (to track user tiers)

**Test:**
- Free tier users see only 5 findings
- Upgrade banner appears
- Watermark on reports

---

## 🔄 Feature 7: Scan Diff

**What it does:** Compare two scans to see what changed.

**Why enable it:** Pro tier feature for tracking security improvements.

### Setup (2 minutes)

Add to `.env`:
```bash
FEATURE_SCAN_DIFF_ENABLED="true"
NEXT_PUBLIC_SCAN_DIFF_ENABLED="true"
```

**Test:**
```bash
# Scan the same URL twice
curl -X POST http://localhost:3001/api/v1/scans -H "Content-Type: application/json" -d '{"url":"example.com"}'
# Copy scan ID 1

curl -X POST http://localhost:3001/api/v1/scans -H "Content-Type: application/json" -d '{"url":"example.com"}'
# Copy scan ID 2

# Compare
curl http://localhost:3001/api/v1/scans/{id2}/diff/{id1}
```

---

## ✅ Recommended Configuration

For **production launch**, enable:
1. ✅ **LLM Enrichment** - Better reports
2. ✅ **Sentry** - Error tracking
3. ⚠️ **Stripe** - Only if monetizing
4. ⚠️ **NextAuth** - Only if need user accounts
5. ⚠️ **Tier Gating** - Only with Stripe

For **local dev**, you only need:
- Nothing! Works with zero config 🎉

---

## 🐛 Troubleshooting

### Features not showing up
- Check environment variables are set correctly
- Restart dev server (`npm run dev`)
- Check `/api/health` to see enabled features

### "Feature not enabled" errors
- Verify `NEXT_PUBLIC_` prefix for client-side features
- Check `.env` file exists and is loaded
- Clear Next.js cache: `rm -rf .next && npm run dev`

### Stripe webhooks failing (production)
- Verify webhook URL is correct
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Test with Stripe CLI: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`

---

## 📊 Check Current Configuration

Visit the health endpoint to see what's enabled:

```bash
curl http://localhost:3001/api/health
```

Response shows all feature statuses:
```json
{
  "features": {
    "scanDiff": false,
    "pdfExport": false,
    "stripe": false,
    "auth": false,
    "tierGating": false,
    "llmEnrichment": false
  }
}
```

---

**Need help?** Check `.env.example` for all available options!
