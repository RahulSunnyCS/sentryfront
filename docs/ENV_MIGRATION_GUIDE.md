# Environment Variables Migration Guide

## Overview

VibeSafe now uses a **single `FEATURES` environment variable** instead of individual boolean flags for each feature. This simplifies configuration and makes it easier to manage features.

## What Changed

### ✅ **Old Approach** (Individual Flags):
```bash
PERFORMANCE_SCANNING_ENABLED="true"
NEXT_PUBLIC_PERFORMANCE_SCANNING_ENABLED="true"
ACCESSIBILITY_SCANNING_ENABLED="true"
NEXT_PUBLIC_ACCESSIBILITY_SCANNING_ENABLED="true"
SEO_SCANNING_ENABLED="true"
NEXT_PUBLIC_SEO_SCANNING_ENABLED="true"
FEATURE_SCAN_DIFF_ENABLED="true"
NEXT_PUBLIC_SCAN_DIFF_ENABLED="true"
PDF_EXPORT_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
STRIPE_ENABLED="false"
NEXT_PUBLIC_STRIPE_ENABLED="false"
AUTH_ENABLED="true"
NEXT_PUBLIC_AUTH_ENABLED="true"
TIER_GATING_ENABLED="true"
NEXT_PUBLIC_TIER_GATING_ENABLED="true"
```

### ✨ **New Approach** (Single JSON Object):
```bash
# All features enabled by default!
# Only set FEATURES if you want to disable something:

FEATURES='{"stripe":false,"tierGating":false}'
```

## Migration Steps

### 1. **Remove Obsolete Environment Variables**

Delete these lines from your `.env` file:

```bash
# DELETE THESE (no longer needed):
PERFORMANCE_SCANNING_ENABLED="true"
NEXT_PUBLIC_PERFORMANCE_SCANNING_ENABLED="true"
ACCESSIBILITY_SCANNING_ENABLED="true"
NEXT_PUBLIC_ACCESSIBILITY_SCANNING_ENABLED="true"
SEO_SCANNING_ENABLED="true"
NEXT_PUBLIC_SEO_SCANNING_ENABLED="true"
FEATURE_SCAN_DIFF_ENABLED="true"
NEXT_PUBLIC_SCAN_DIFF_ENABLED="true"
PDF_EXPORT_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
STRIPE_ENABLED="false"
NEXT_PUBLIC_STRIPE_ENABLED="false"
AUTH_ENABLED="true"
NEXT_PUBLIC_AUTH_ENABLED="true"
TIER_GATING_ENABLED="true"
NEXT_PUBLIC_TIER_GATING_ENABLED="true"
LLM_ENRICHMENT_ENABLED="false"
SENTRY_ENABLED="true"
NEXT_PUBLIC_SENTRY_ENABLED="true"
```

### 2. **Add FEATURES Variable (Optional)**

**By default, ALL features are enabled!**

Only add `FEATURES` if you want to disable specific features:

```bash
# Example 1: Disable monetization for open-source deployment
FEATURES='{"stripe":false,"tierGating":false}'

# Example 2: Disable all scanning enhancements (security only)
FEATURES='{"performanceScanning":false,"accessibilityScanning":false,"seoScanning":false}'

# Example 3: Disable everything except security scanning
FEATURES='{"performanceScanning":false,"accessibilityScanning":false,"seoScanning":false,"scanDiff":false,"pdfExport":false,"stripe":false,"auth":false,"tierGating":false}'
```

### 3. **Simplify Other Variables**

You can also remove redundant `NEXT_PUBLIC_*` variables that aren't needed:

```bash
# DELETE THESE:
NEXT_PUBLIC_SCAN_DIFF_ENABLED
NEXT_PUBLIC_PDF_EXPORT_ENABLED
NEXT_PUBLIC_STRIPE_ENABLED
NEXT_PUBLIC_AUTH_ENABLED
NEXT_PUBLIC_TIER_GATING_ENABLED
NEXT_PUBLIC_SENTRY_ENABLED
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_AUTH_PROVIDER
NEXT_PUBLIC_PERFORMANCE_SCANNING_ENABLED
NEXT_PUBLIC_ACCESSIBILITY_SCANNING_ENABLED
NEXT_PUBLIC_SEO_SCANNING_ENABLED
```

## Complete List of Deletable Variables

Here's the **complete list of environment variables you can safely delete**:

```bash
# Feature Flags (replaced by FEATURES)
PERFORMANCE_SCANNING_ENABLED
NEXT_PUBLIC_PERFORMANCE_SCANNING_ENABLED
ACCESSIBILITY_SCANNING_ENABLED  
NEXT_PUBLIC_ACCESSIBILITY_SCANNING_ENABLED
SEO_SCANNING_ENABLED
NEXT_PUBLIC_SEO_SCANNING_ENABLED
FEATURE_SCAN_DIFF_ENABLED
NEXT_PUBLIC_SCAN_DIFF_ENABLED
PDF_EXPORT_ENABLED
NEXT_PUBLIC_PDF_EXPORT_ENABLED
STRIPE_ENABLED
NEXT_PUBLIC_STRIPE_ENABLED
AUTH_ENABLED
NEXT_PUBLIC_AUTH_ENABLED
TIER_GATING_ENABLED
NEXT_PUBLIC_TIER_GATING_ENABLED
LLM_ENRICHMENT_ENABLED
LLM_ENRICHMENT_TIMEOUT_MS
SENTRY_ENABLED
NEXT_PUBLIC_SENTRY_ENABLED

# Duplicates (keep only one)
NEXT_PUBLIC_SENTRY_DSN           # Keep SENTRY_DSN
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # Keep STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_URL          # Keep SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Keep SUPABASE_ANON_KEY
NEXT_PUBLIC_AUTH_PROVIDER         # Keep AUTH_PROVIDER

# Deprecated
DATABASE_POSTGRES_URL             # Keep only DATABASE_URL
DATABASE_PRISMA_DATABASE_URL      # Keep only DATABASE_URL
```

## Minimal Production .env

Here's what a **minimal production `.env`** looks like now:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Optional: PageSpeed API
PAGESPEED_API_KEY="your-key"

# Optional: AI Enrichment
ANTHROPIC_API_KEY="your-key"

# Optional: Disable specific features
FEATURES='{"stripe":false}'

# Optional: Authentication (if auth enabled)
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secret"
GITHUB_ID="your-id"
GITHUB_SECRET="your-secret"

# Optional: Monitoring
SENTRY_DSN="your-dsn"
```

**That's it!** Much cleaner than before.

## Available Features

These are the features you can control via `FEATURES`:

| Feature | Description | Default |
|---------|-------------|---------|
| `performanceScanning` | Lighthouse performance analysis | ✅ Enabled |
| `accessibilityScanning` | WCAG 2.2 compliance checking | ✅ Enabled |
| `seoScanning` | SEO optimization analysis | ✅ Enabled |
| `scanDiff` | Scan comparison feature | ✅ Enabled |
| `pdfExport` | PDF report generation | ✅ Enabled |
| `stripe` | Payment processing | ✅ Enabled |
| `auth` | User authentication | ✅ Enabled |
| `tierGating` | Tier-based restrictions | ✅ Enabled |

## Verification

After migration, verify your configuration:

```bash
# Build to check for errors
npm run build

# Check feature status in code
console.log(features) // in src/lib/features.ts
```

## Rollback

If you need to rollback, the old environment variables still work (with a deprecation warning). But we recommend migrating to the new approach for simpler configuration.
