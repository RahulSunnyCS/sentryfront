# VibeSafe Monorepo: Complete Implementation Guide

**Last Updated:** 2026-05-13  
**Version:** 1.0  
**Target Audience:** VibeSafe development team

---

## 📚 Table of Contents

1. [What is a Monorepo?](#what-is-a-monorepo)
2. [Why VibeSafe Needs a Monorepo](#why-vibesafe-needs-a-monorepo)
3. [How It Helps Your Project](#how-it-helps-your-project)
4. [Advantages](#advantages)
5. [Disadvantages](#disadvantages)
6. [Architecture Overview](#architecture-overview)
7. [Implementation Steps](#implementation-steps)
8. [Testing Strategy](#testing-strategy)
9. [CI/CD Setup](#cicd-setup)
10. [Decision Framework](#decision-framework)
11. [FAQs](#faqs)
12. [Resources](#resources)

---

## 📖 What is a Monorepo?

### Definition

A **monorepo** (monolithic repository) is a software development strategy where code for multiple projects, applications, or packages is stored in a single version-controlled repository.

### Structure Example

```
Traditional Multi-Repo Approach:
├── vibesafe-web/          (separate repo)
├── vibesafe-mobile/       (separate repo)
├── vibesafe-cli/          (separate repo)
└── scanner-library/       (separate repo)

Monorepo Approach:
saas-factory/              (single repo)
├── apps/
│   ├── vibesafe-web/
│   ├── vibesafe-mobile/
│   └── vibesafe-cli/
└── packages/
    └── scanner-core/
```

### Key Characteristics

1. **Single Repository:** All code in one place
2. **Shared Dependencies:** Common packages used across apps
3. **Atomic Commits:** Change multiple apps/packages in one commit
4. **Unified Tooling:** Same build, test, lint across all projects
5. **Cross-Project Refactoring:** Rename/refactor across entire codebase

---

## 🎯 Why VibeSafe Needs a Monorepo

### Current Challenges

**As VibeSafe scales, you'll face:**

1. **Code Duplication**
   - Scanner logic duplicated in web, mobile, CLI
   - Auth logic duplicated across platforms
   - Same AI enrichment code copied 3+ times

2. **Dependency Hell**
   ```bash
   # Web app uses scanner v1.5
   # Mobile app uses scanner v1.3
   # CLI uses scanner v2.0
   # Which one is correct? 😱
   ```

3. **Breaking Changes**
   - Update auth in web → mobile breaks
   - Update scanner → CLI breaks
   - No way to test across all apps

4. **Deployment Coordination**
   - Deploy web with new API
   - Mobile still uses old API
   - Users get errors

### What Monorepo Solves

1. ✅ **Single Source of Truth:** One `scanner-core` package, shared by all
2. ✅ **Atomic Changes:** Update API + all clients in one commit
3. ✅ **Type Safety:** TypeScript errors if you break anything
4. ✅ **Shared Infrastructure:** Auth, billing, DB, AI logic - write once

---

## 🚀 How It Helps Your Project

### 1. Multi-Platform Support

**Scenario:** You want web + mobile + CLI

**Without Monorepo:**
```bash
# Build scanner 3 times
vibesafe-web/lib/scanner.ts
vibesafe-mobile/lib/scanner.ts
vibesafe-cli/lib/scanner.ts

# Bug in scanner? Fix 3 times! 😫
```

**With Monorepo:**
```bash
# Build once, use everywhere
packages/scanner-core/src/index.ts

# Bug? Fix once, all apps get the fix ✅
```

### 2. Product Portfolio

**Goal:** Build multiple SaaS products (VibeSafe, SpeedCheck, A11yAudit)

**Without Monorepo:**
```bash
# Duplicate everything 3 times
vibesafe/
  ├── auth.ts      (duplicated)
  ├── billing.ts   (duplicated)
  └── scanner.ts   (duplicated)

speedcheck/
  ├── auth.ts      (duplicated)
  ├── billing.ts   (duplicated)
  └── scanner.ts   (duplicated)

a11y-audit/
  ├── auth.ts      (duplicated)
  ├── billing.ts   (duplicated)
  └── scanner.ts   (duplicated)
```

**With Monorepo:**
```bash
packages/
  ├── auth/         (shared)
  ├── billing/      (shared)
  └── scanner-core/ (shared)

apps/
  ├── vibesafe/     (imports packages)
  ├── speedcheck/   (imports packages)
  └── a11y-audit/   (imports packages)

# 70% code reuse! 🚀
```

### 3. Developer Experience

**Benefits:**
- ✅ One `git clone` gets everything
- ✅ One `pnpm install` installs all dependencies
- ✅ One `turbo dev` runs all apps
- ✅ Jump between apps/packages in same IDE
- ✅ Search across entire codebase

### 4. Testing Confidence

**Scenario:** Change scanner-core

**Without Monorepo:**
```bash
# Change scanner in web repo
# ❌ No idea if mobile/CLI will break
# 😱 Find out in production
```

**With Monorepo:**
```bash
# Change packages/scanner-core
turbo run test

# ✅ All apps tested automatically
# ✅ TypeScript errors if anything breaks
# ✅ Can't deploy until all tests pass
```

### 5. Time to Market

**Launching a new product:**

**Without Monorepo:**
```
Week 1-2: Setup auth (again)
Week 3-4: Setup billing (again)
Week 5-6: Build scanner (again)
Week 7-8: Build UI
Total: 8 weeks
```

**With Monorepo:**
```
Week 1: Import existing packages
Week 2: Build product-specific UI
Week 3: Polish & deploy
Total: 3 weeks (62% faster!)
```

---

## ✅ Advantages

### 1. Code Reuse (70%+)

**Real Example:**

```ts
// packages/scanner-core/src/index.ts (1,200 lines)
export async function runScan(url: string): Promise<ScanResult> {
  // Complex security scanning logic
}

// Used by:
// ✅ apps/vibesafe-web/app/api/scan.ts
// ✅ apps/vibesafe-mobile/screens/ScanScreen.tsx
// ✅ apps/vibesafe-cli/commands/scan.ts
// ✅ apps/speedcheck/app/api/scan.ts
// ✅ apps/a11y-audit/app/api/scan.ts

// Total reuse: 1,200 lines × 5 apps = 6,000 lines saved!
```

**Packages you can share:**
- ✅ `scanner-core` - Scanning engine (1,200 lines)
- ✅ `auth` - Authentication logic (800 lines)
- ✅ `billing` - Stripe integration (600 lines)
- ✅ `ai-core` - LLM enrichment (400 lines)
- ✅ `db` - Database client (200 lines)
- ✅ Total: 3,200 lines × 5 apps = **16,000 lines saved**

### 2. Type Safety Across Everything

**Example:**

```ts
// Change a type in packages/scanner-core
export interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  // Add new field
  cveId?: string; // ← New field
}

// TypeScript immediately shows errors in ALL apps:
// ❌ apps/vibesafe/components/FindingCard.tsx:45
// ❌ apps/speedcheck/components/ResultTable.tsx:23
// ❌ apps/vibesafe-mobile/screens/Results.tsx:67

// You MUST fix all apps before code compiles
// No runtime surprises! ✅
```

### 3. Atomic Cross-App Changes

**Example:** Update API contract

```bash
# One commit updates everything
git commit -m "Add CVE tracking to findings"

Modified files:
  packages/scanner-core/types.ts
  apps/vibesafe/app/api/scan.ts
  apps/vibesafe/components/FindingCard.tsx
  apps/vibesafe-mobile/screens/Results.tsx
  apps/speedcheck/app/api/scan.ts

# All apps stay in sync ✅
```

### 4. Shared Tooling & Standards

**Configuration reuse:**

```
packages/
├── eslint-config/
│   └── index.js          # Shared linting rules
├── typescript-config/
│   ├── base.json         # Base TypeScript config
│   └── nextjs.json       # Next.js-specific config
└── prettier-config/
    └── index.js          # Shared formatting

# All apps inherit same standards
apps/vibesafe/eslintrc.js: extends: ['@repo/eslint-config']
apps/speedcheck/eslintrc.js: extends: ['@repo/eslint-config']
```

### 5. Simplified Dependency Management

**Before (multi-repo):**
```json
// vibesafe-web/package.json
"dependencies": { "next": "14.0.0" }

// vibesafe-mobile/package.json (different version!)
"dependencies": { "react": "18.2.0" }

// vibesafe-cli/package.json (different again!)
"dependencies": { "commander": "11.0.0" }
```

**After (monorepo):**
```json
// Root package.json
"dependencies": {
  "typescript": "5.3.3"  // Used by ALL packages
}

// Apps only declare what they need
apps/vibesafe/package.json:
  "next": "14.0.0"

apps/vibesafe-mobile/package.json:
  "react-native": "0.73.0"
```

### 6. Better Collaboration

**Developer experience:**
- ✅ One repo to clone
- ✅ See entire codebase in IDE
- ✅ Cross-reference between apps easily
- ✅ Grep/search across everything
- ✅ Refactor with confidence

**Team benefits:**
- ✅ Frontend/backend/mobile devs share code
- ✅ No "wait for library update" delays
- ✅ Easier code reviews (see all changes)
- ✅ Onboarding: clone once, see everything

### 7. Faster CI/CD

**With caching:**

```bash
# First build: 8 minutes (build everything)
turbo run build

# Second build (no changes): 5 seconds (cache hit)
turbo run build

# Change scanner-core: 2 minutes (only rebuild affected apps)
turbo run build --filter='...[HEAD^1]'
```

**Turborepo automatically:**
- ✅ Caches build outputs
- ✅ Only rebuilds what changed
- ✅ Parallelizes tasks
- ✅ Shares cache across team

### 8. Consistent Deployment

**Deploy all apps with one command:**

```bash
# Build all apps
turbo run build

# Deploy all (or selectively)
vercel deploy apps/vibesafe
vercel deploy apps/speedcheck
vercel deploy apps/a11y-audit

# Or use Vercel monorepo support (auto-deploy on change)
```

---

## ⚠️ Disadvantages

### 1. Increased Complexity

**Challenge:** More moving parts

**Example:**
```
Monolith: 1 package.json, 1 tsconfig.json
Monorepo: 10+ package.json, 10+ tsconfig.json
```

**Impact:**
- ⚠️ Steeper learning curve
- ⚠️ More configuration to understand
- ⚠️ Harder for beginners

**Mitigation:**
- ✅ Good documentation (this guide!)
- ✅ Use generators (`turbo gen package`)
- ✅ Consistent patterns
- ✅ Onboarding guides

**Severity:** Medium (manageable with docs)

---

### 2. Longer Initial Build Times

**Challenge:** Building all packages + apps

**Numbers:**
```
Monolith:     2 minutes
Monorepo:     8 minutes (first build)
              30s (subsequent with cache)
```

**Impact:**
- ⚠️ Slower initial setup
- ⚠️ CI might take longer

**Mitigation:**
- ✅ Turborepo caching
- ✅ Remote caching (Vercel)
- ✅ Parallel builds
- ✅ Only build what changed

**Severity:** Low (solved by caching)

---

### 3. Version Management Overhead

**Challenge:** Coordinating package versions

**Example:**
```bash
# Package updated
packages/scanner-core: v1.5.0 → v2.0.0 (breaking change)

# All apps must update
apps/vibesafe: update scanner-core import
apps/speedcheck: update scanner-core import
apps/mobile: update scanner-core import

# If you forget one, it breaks!
```

**Impact:**
- ⚠️ Manual coordination needed
- ⚠️ Risk of version drift

**Mitigation:**
- ✅ Use Changesets
- ✅ TypeScript catches incompatibilities
- ✅ Integration tests
- ✅ Automated version bumping

**Severity:** Medium (requires discipline)

---

### 4. Testing Surface Expands

**Challenge:** More test scenarios

**Numbers:**
```
Monolith:  1 app  × 50 tests = 50 tests
Monorepo:  5 apps × 50 tests = 250 tests
          +5 packages × 20 tests = 100 tests
          = 350 total tests
```

**Impact:**
- ⚠️ More tests to write
- ⚠️ Longer test suite runtime

**Mitigation:**
- ✅ Parallel test execution
- ✅ Contract tests (avoid duplication)
- ✅ Focus on integration tests
- ✅ Smart test selection (only test changed code)

**Severity:** Medium (worth it for confidence)

---

### 5. Potential for Breaking Changes

**Challenge:** One change breaks multiple apps

**Example:**
```ts
// Developer changes packages/auth
export function login(email: string) {
  // Removed password parameter!
}

// ❌ Breaks all apps using login()
apps/vibesafe/login.ts
apps/speedcheck/login.ts
apps/mobile/AuthScreen.tsx
```

**Impact:**
- ⚠️ One bad commit affects everything
- ⚠️ Requires careful reviews

**Mitigation:**
- ✅ TypeScript (catches at compile time)
- ✅ Integration tests
- ✅ Contract tests
- ✅ Code review process
- ✅ CI blocks bad commits

**Severity:** High BUT TypeScript prevents it

---

### 6. Tooling Lock-in

**Challenge:** Committed to Turborepo/pnpm

**Alternatives:**
- Nx
- Lerna
- Rush
- Yarn workspaces

**Impact:**
- ⚠️ Hard to switch tools later
- ⚠️ Team must learn specific tool

**Mitigation:**
- ✅ Turborepo is industry standard
- ✅ Can migrate between tools if needed
- ✅ Underlying tech is just npm workspaces

**Severity:** Low (not a real concern)

---

### 7. Harder to Extract Code

**Challenge:** Moving package out of monorepo

**Example:**
```bash
# Want to open-source scanner-core?
# It's deeply integrated with monorepo structure

packages/scanner-core/
  imports from: @repo/db, @repo/logger, @repo/types
  uses: turbo.json, root tsconfig
```

**Impact:**
- ⚠️ Can't easily publish to npm
- ⚠️ Hard to share with external teams

**Mitigation:**
- ✅ Keep packages independent
- ✅ Minimize cross-package dependencies
- ✅ Use standard npm patterns

**Severity:** Medium (design packages carefully)

---

### 8. Merge Conflicts More Likely

**Challenge:** More developers touching shared code

**Example:**
```bash
# Developer A changes packages/scanner-core
# Developer B also changes packages/scanner-core
# Merge conflict! 😱
```

**Impact:**
- ⚠️ More coordination needed
- ⚠️ Blocked PRs

**Mitigation:**
- ✅ Smaller, frequent commits
- ✅ Good communication
- ✅ Feature flags
- ✅ Clear ownership (CODEOWNERS file)

**Severity:** Low (normal in team development)

---

### 9. Overkill for Small Projects

**Challenge:** Too much infrastructure for 1 product

**When it's overkill:**
- ❌ Solo developer
- ❌ Single product (just web app)
- ❌ MVP/prototype stage
- ❌ No code reuse yet

**When it makes sense:**
- ✅ 2+ related products
- ✅ Multiple platforms (web + mobile)
- ✅ Team of 2+ developers
- ✅ Clear code reuse opportunities

**Severity:** High (don't overengineer early!)

---

### 10. Deployment Coordination

**Challenge:** Deploying multiple apps

**Example:**
```bash
# Update shared API
packages/api-client: v2.0.0 (breaking change)

# Must deploy in order:
1. Deploy backend (supports v2 API)
2. Deploy web app (uses v2 API)
3. Deploy mobile app (uses v2 API)
4. Deploy CLI (uses v2 API)

# Deploy out of order = broken apps! 😱
```

**Impact:**
- ⚠️ Requires deployment orchestration
- ⚠️ Risk of downtime

**Mitigation:**
- ✅ Backwards-compatible APIs
- ✅ Feature flags
- ✅ Versioned endpoints (/v1, /v2)
- ✅ Independent deploys (where possible)

**Severity:** Medium (plan deployments carefully)

---

## 📊 Advantages vs Disadvantages Summary

| Aspect | Advantage | Disadvantage | Severity | Mitigated? |
|--------|-----------|--------------|----------|------------|
| **Code Reuse** | 70%+ shared code | - | - | N/A |
| **Type Safety** | Catch errors early | - | - | N/A |
| **Build Time** | Fast with cache | Slow initial build | Low | ✅ Yes |
| **Testing** | Comprehensive coverage | More tests needed | Medium | ✅ Yes |
| **Complexity** | - | Steeper learning curve | Medium | ✅ Docs help |
| **Breaking Changes** | - | Can break multiple apps | High | ✅ TypeScript |
| **Deployment** | Consistent process | Coordination needed | Medium | ✅ Feature flags |
| **Version Mgmt** | Single source of truth | Manual coordination | Medium | ✅ Changesets |
| **Collaboration** | Better DX | More merge conflicts | Low | ✅ Communication |
| **Scalability** | Easy to add products | Overkill for MVPs | High | ⚠️ Start simple |

**Overall:** Advantages outweigh disadvantages for VibeSafe's multi-platform, multi-product strategy.

---

## 🏗️ Architecture Overview

### Target Monorepo Structure

```
saas-factory/
├── apps/
│   ├── vibesafe-web/              # Next.js 14 - All-in-one scanner
│   ├── vibesafe-mobile/           # React Native (Expo) - Mobile app
│   ├── vibesafe-cli/              # CLI tool for developers
│   ├── speedcheck/                # Next.js - Performance-only product
│   ├── a11y-audit/                # Next.js - Accessibility product
│   └── admin/                     # Internal admin dashboard
│
├── packages/
│   ├── scanner-core/              # ⭐ Core scanning engine (platform-agnostic)
│   ├── auth/                      # Authentication (platform adapters)
│   ├── billing/                   # Stripe subscriptions & usage metering
│   ├── ai-core/                   # LLM enrichment (Anthropic, OpenAI)
│   ├── db/                        # Prisma client & Redis
│   ├── ui-web/                    # React web components
│   ├── ui-native/                 # React Native components
│   ├── ui-core/                   # Headless components & hooks
│   ├── analytics/                 # Event tracking
│   ├── notifications/             # Email, webhooks, alerts
│   ├── pdf-export/                # PDF generation
│   └── shared/                    # Utils, types, constants
│
├── tooling/
│   ├── eslint-config/             # Shared ESLint config
│   ├── typescript-config/         # Shared TypeScript config
│   └── vitest-config/             # Shared test config
│
├── turbo.json                     # Turborepo configuration
├── package.json                   # Root package.json
├── pnpm-workspace.yaml            # pnpm workspace config
└── .github/
    └── workflows/
        └── ci.yml                 # CI/CD pipeline
```

---

### Package Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Applications Layer                    │
├─────────────────────────────────────────────────────────┤
│  vibesafe-web   speedcheck   a11y-audit   vibesafe-mobile │
└───────────┬─────────┬──────────┬──────────────┬──────────┘
            │         │          │              │
            └─────────┴──────────┴──────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
    ┌───────▼────────┐                  ┌──────▼──────┐
    │  scanner-core  │                  │   ai-core   │
    │  (reusable)    │                  │  (reusable) │
    └───────┬────────┘                  └──────┬──────┘
            │                                   │
    ┌───────▼────────┐                  ┌──────▼──────┐
    │     auth       │                  │   billing   │
    │ (platform adapters)               │  (Stripe)   │
    └───────┬────────┘                  └──────┬──────┘
            │                                   │
            └───────────────┬───────────────────┘
                            │
                    ┌───────▼────────┐
                    │   db (Prisma)  │
                    │   shared types │
                    └────────────────┘
```

**Key Principle:** Dependencies flow one direction (apps → packages → shared)

---

### Package Responsibilities

#### **scanner-core** (Most Important!)

**Purpose:** Platform-agnostic scanning engine

**Responsibilities:**
- HTTP crawling & fetching
- 15 security modules
- Performance analysis
- Accessibility checks
- SEO analysis
- Grading algorithm

**Consumers:**
- ✅ Web app (API routes)
- ✅ Mobile app (local scans)
- ✅ CLI tool
- ✅ All product variants

**Example:**
```ts
// packages/scanner-core/src/index.ts
export async function runScan(
  url: string,
  options: ScanOptions
): Promise<ScanResult> {
  const crawlResult = await crawl(url);

  const findings = await Promise.all([
    runSecurityModules(crawlResult),
    runPerformanceModules(crawlResult),
    runAccessibilityModules(crawlResult),
    runSEOModules(crawlResult),
  ]);

  return {
    findings: findings.flat(),
    grade: calculateGrade(findings),
    score: calculateScore(findings),
  };
}
```

---

#### **auth** (Platform Adapters)

**Purpose:** Unified authentication across platforms

**Structure:**
```
packages/auth/
├── src/
│   ├── core/
│   │   ├── session.ts       # Platform-agnostic session logic
│   │   ├── jwt.ts           # JWT verification
│   │   └── types.ts         # Shared types (User, Session)
│   │
│   ├── adapters/
│   │   ├── nextauth/        # Next.js (server-side)
│   │   ├── expo/            # React Native
│   │   └── cli/             # CLI tool (API key auth)
│   │
│   └── index.ts             # Smart exports based on platform
```

**Usage:**
```ts
// Next.js app
import { nextAuthConfig } from '@repo/auth/nextauth';

// React Native app
import { AuthProvider, useAuth } from '@repo/auth/expo';

// CLI tool
import { verifyApiKey } from '@repo/auth/cli';

// All share same User type and session logic!
```

---

#### **billing**

**Purpose:** Stripe subscriptions & usage metering

**Responsibilities:**
- Subscription management
- Usage-based billing
- Tier enforcement
- Webhook handling

**Example:**
```ts
// packages/billing/src/subscriptions.ts
export async function checkTier(
  userId: string,
  requiredTier: 'free' | 'pro' | 'business'
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const tiers = ['free', 'pro', 'business'];
  return tiers.indexOf(user.tier) >= tiers.indexOf(requiredTier);
}

// Used by all apps
import { checkTier } from '@repo/billing';
await checkTier(user.id, 'pro'); // ✅
```

---

#### **ai-core**

**Purpose:** LLM enrichment (provider-agnostic)

**Structure:**
```
packages/ai-core/
├── src/
│   ├── providers/
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   └── gemini.ts
│   │
│   ├── enrichment.ts        # Main enrichment logic
│   ├── caching.ts           # Response caching
│   └── usage-tracking.ts    # Token counting
```

**Usage:**
```ts
// Works with any product
import { enrichFindings } from '@repo/ai-core';

// VibeSafe: security context
const enriched = await enrichFindings(findings, 'security');

// SpeedCheck: performance context
const enriched = await enrichFindings(perfIssues, 'performance');
```

---

#### **ui-core** (Headless Components)

**Purpose:** Shared component logic WITHOUT styling

**What to share:**
```ts
// ✅ Share behavior
export function useDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setSelectedIndex(i => i + 1);
    if (e.key === 'ArrowUp') setSelectedIndex(i => i - 1);
  };

  return { isOpen, selectedIndex, handleKeyDown };
}

// ❌ Don't share appearance
// Each app styles differently
```

---

#### **ui-web** vs **ui-native**

**Why separate?**
- Different rendering engines (React DOM vs React Native)
- Different styling approaches (CSS vs StyleSheet)
- Different components (div vs View)

**Example:**
```tsx
// packages/ui-web/Button.tsx
export function Button({ children, variant }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}

// packages/ui-native/Button.tsx
import { Pressable, Text } from 'react-native';

export function Button({ children, variant }: ButtonProps) {
  return (
    <Pressable style={styles[variant]}>
      <Text>{children}</Text>
    </Pressable>
  );
}

// Apps import platform-specific version
// apps/vibesafe-web: import { Button } from '@repo/ui-web';
// apps/vibesafe-mobile: import { Button } from '@repo/ui-native';
```

---

### Cross-Platform Code Sharing

#### What CAN Be Shared (70%)

| Package | Web | Mobile | CLI | Desktop | Notes |
|---------|-----|--------|-----|---------|-------|
| `scanner-core` | ✅ | ✅ | ✅ | ✅ | Pure TypeScript |
| `ai-core` | ✅ | ✅ | ✅ | ✅ | API calls |
| `billing` | ✅ | ✅ | ✅ | ✅ | Stripe SDK |
| `auth/core` | ✅ | ✅ | ✅ | ✅ | JWT logic |
| `db` | ✅ | ❌ | ✅ | ✅ | Server-side only |
| `shared` | ✅ | ✅ | ✅ | ✅ | Utils, types |

#### What CANNOT Be Shared (30%)

| Package | Why Not Shared |
|---------|----------------|
| `ui-web` | React DOM-specific |
| `ui-native` | React Native-specific |
| `auth/nextauth` | Next.js-specific |
| `auth/expo` | React Native-specific |

**Strategy:** Share business logic, separate UI/platform layers

---

## 📋 Implementation Steps

### Prerequisites

Before starting, ensure you have:

```bash
# Node.js 18+
node --version  # v18.0.0 or higher

# pnpm (required for monorepo)
npm install -g pnpm@8

# Git
git --version
```

---

### Week 1: Initial Setup (Days 1-3)

#### Step 1.1: Create New Monorepo

**Option A: Fresh start (Recommended)**

```bash
# Navigate to parent directory
cd ~/Projects

# Create new Turborepo
npx create-turbo@latest saas-factory

# Prompts:
# - Package manager: pnpm
# - Remote caching: Skip for now

cd saas-factory
```

**Option B: Add to existing project**

```bash
# In your current sentryfront directory
pnpm add turbo -D

# Create structure
mkdir -p apps packages tooling

# Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << EOF
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
EOF
```

---

#### Step 1.2: Configure Turborepo

**Create turbo.json:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Update root package.json:**

```json
{
  "name": "saas-factory",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^1.11.0",
    "typescript": "^5.3.3",
    "@changesets/cli": "^2.27.1"
  },
  "packageManager": "pnpm@8.10.0",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

#### Step 1.3: Migrate Existing VibeSafe

```bash
# Assuming you're in saas-factory directory

# Copy current project (excluding node_modules, .next, .git)
rsync -av --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.turbo' \
  ~/Projects/sentryfront/ apps/vibesafe/

# Update package name
cd apps/vibesafe
```

**Edit apps/vibesafe/package.json:**

```json
{
  "name": "@saas/vibesafe",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "type-check": "tsc --noEmit"
  }
  // ... rest of dependencies stay the same
}
```

---

#### Step 1.4: Verify Setup

```bash
# From root directory
pnpm install

# Test dev mode
pnpm dev
# Should start apps/vibesafe on localhost:3000

# Test build
pnpm build
# Should build successfully

# Commit initial setup
git init
git add .
git commit -m "chore: initialize monorepo with Turborepo"
```

✅ **Milestone:** Monorepo setup complete, VibeSafe running

---

### Week 2: Extract Core Packages (Days 4-10)

#### Step 2.1: Create Shared TypeScript Config

```bash
mkdir -p tooling/typescript-config
cd tooling/typescript-config
```

**tooling/typescript-config/package.json:**

```json
{
  "name": "@repo/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "nextjs.json", "react-native.json"]
}
```

**tooling/typescript-config/base.json:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "exclude": ["node_modules"]
}
```

---

#### Step 2.2: Extract scanner-core Package

**This is your most valuable asset!**

```bash
mkdir -p packages/scanner-core
cd packages/scanner-core
```

**packages/scanner-core/package.json:**

```json
{
  "name": "@repo/scanner-core",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.3.3",
    "vitest": "^1.0.4"
  }
}
```

**Move scanner files:**

```bash
# Copy from VibeSafe app
cp -r ../../apps/vibesafe/src/lib/scanner/* ./src/

# Structure:
packages/scanner-core/
├── src/
│   ├── index.ts           # Public API
│   ├── crawler.ts
│   ├── types.ts
│   ├── grading.ts
│   ├── modules/
│   │   ├── p1-01-secrets.ts
│   │   ├── p1-02-sourcemaps.ts
│   │   └── ... (all 15 modules)
│   └── __tests__/
│       └── grading.test.ts
├── package.json
└── tsconfig.json
```

**packages/scanner-core/src/index.ts:**

```ts
// Public API - what apps can import
export { runScan } from './scanner';
export { calculateGrade, calculateScore } from './grading';
export type {
  ScanResult,
  Finding,
  ScanOptions,
  CrawlResult
} from './types';
```

---

#### Step 2.3: Update VibeSafe to Use Package

**apps/vibesafe/package.json:**

```json
{
  "dependencies": {
    "@repo/scanner-core": "workspace:*",
    // ... other deps
  }
}
```

**apps/vibesafe/app/api/v1/scans/route.ts:**

```ts
// Before
import { runScanner } from '@/lib/scanner';

// After
import { runScan } from '@repo/scanner-core';

export async function POST(req: Request) {
  const { url } = await req.json();

  // Now using shared package!
  const result = await runScan(url);

  return Response.json(result);
}
```

**Test it works:**

```bash
# From root
pnpm install
pnpm dev

# Visit localhost:3000, run a scan
# Should work exactly as before!
```

✅ **Milestone:** scanner-core extracted and working

---

#### Step 2.4: Extract Other Core Packages

**Repeat for:**

1. **@repo/ai-core** (LLM enrichment)
2. **@repo/auth** (authentication)
3. **@repo/billing** (Stripe)
4. **@repo/db** (Prisma client)
5. **@repo/shared** (utils, types)

**Example: @repo/shared**

```bash
mkdir -p packages/shared
cd packages/shared
```

```json
{
  "name": "@repo/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./utils": "./dist/utils.js",
    "./types": "./dist/types.js",
    "./constants": "./dist/constants.js"
  }
}
```

**packages/shared/src/utils.ts:**

```ts
// Shared utilities
export function formatUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### Week 3: Build Second Product (Days 11-17)

**Goal:** Validate shared packages work by building SpeedCheck

#### Step 3.1: Create SpeedCheck App

```bash
cd apps
npx create-next-app@latest speedcheck

# Options:
# - TypeScript: Yes
# - ESLint: Yes
# - Tailwind: Yes
# - App Router: Yes
```

**apps/speedcheck/package.json:**

```json
{
  "name": "@saas/speedcheck",
  "dependencies": {
    "@repo/scanner-core": "workspace:*",
    "@repo/ai-core": "workspace:*",
    "@repo/auth": "workspace:*",
    "@repo/billing": "workspace:*",
    "next": "14.0.4",
    "react": "^18.2.0"
  }
}
```

---

#### Step 3.2: Build SpeedCheck Homepage

**apps/speedcheck/app/page.tsx:**

```tsx
export default function HomePage() {
  return (
    <div style={{
      background: 'linear-gradient(to bottom, #10b981, #059669)',
      minHeight: '100vh'
    }}>
      <h1>SpeedCheck</h1>
      <p>Website Performance Scanner</p>
      {/* Reuse scanning logic, different branding! */}
    </div>
  );
}
```

---

#### Step 3.3: Reuse Scanning Logic

**apps/speedcheck/app/api/v1/scans/route.ts:**

```ts
import { runScan } from '@repo/scanner-core';
import { enrichFindings } from '@repo/ai-core';

export async function POST(req: Request) {
  const { url } = await req.json();

  // Same scanner, different filtering!
  const result = await runScan(url, {
    modules: ['performance'], // Only performance modules
  });

  // Enrich with performance context
  const enriched = await enrichFindings(
    result.findings,
    'performance-optimization'
  );

  return Response.json({
    ...result,
    findings: enriched,
  });
}
```

**That's it!** 70% of code reused from packages.

---

#### Step 3.4: Test Both Apps

```bash
# Run both apps simultaneously
pnpm dev

# VibeSafe: localhost:3000
# SpeedCheck: localhost:3001

# Or run individually
turbo run dev --filter=vibesafe
turbo run dev --filter=speedcheck
```

✅ **Milestone:** Second product built in 1 week using shared packages!

---

## 🧪 Testing Strategy

### Testing Philosophy

**The Problem:** In a monorepo, one change can break multiple apps

**The Solution:** Multi-layered testing strategy

```
┌─────────────────────────────────────────┐
│         E2E Tests (Playwright)          │  ← Real user flows
├─────────────────────────────────────────┤
│      Integration Tests (Vitest)        │  ← Apps + Packages
├─────────────────────────────────────────┤
│       Contract Tests (Vitest)          │  ← API contracts
├─────────────────────────────────────────┤
│       Unit Tests (Vitest)              │  ← Individual functions
└─────────────────────────────────────────┘
```

---

### Layer 1: Unit Tests

**Purpose:** Test individual functions in isolation

**Location:** Inside each package

**Example:**

```ts
// packages/scanner-core/__tests__/grading.test.ts

import { describe, it, expect } from 'vitest';
import { calculateGrade } from '../src/grading';

describe('calculateGrade', () => {
  it('returns A for score >= 90', () => {
    expect(calculateGrade(95)).toBe('A');
    expect(calculateGrade(90)).toBe('A');
  });

  it('returns B for score 80-89', () => {
    expect(calculateGrade(85)).toBe('B');
    expect(calculateGrade(80)).toBe('B');
  });

  it('returns F for score < 60', () => {
    expect(calculateGrade(50)).toBe('F');
    expect(calculateGrade(0)).toBe('F');
  });
});
```

**Run tests:**

```bash
# Test single package
turbo run test --filter=@repo/scanner-core

# Test all packages
turbo run test --filter="./packages/*"
```

**Coverage:** Logic bugs within the package

**Limitations:** Doesn't test integration with apps

---

### Layer 2: Integration Tests

**Purpose:** Test packages + apps working together

**Location:** Inside apps

**Example:**

```ts
// apps/vibesafe/__tests__/integration/scan-api.test.ts

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/v1/scans/route';

describe('POST /api/v1/scans', () => {
  it('creates scan and returns valid result', async () => {
    const request = new Request('http://localhost:3000/api/v1/scans', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify integration between app + scanner-core
    expect(data.id).toBeDefined();
    expect(data.grade).toMatch(/[A-F]/);
    expect(data.findings).toBeInstanceOf(Array);
    expect(data.findings[0]).toHaveProperty('severity');
    expect(data.findings[0]).toHaveProperty('title');
  });

  it('enriches findings with AI', async () => {
    const request = new Request('http://localhost:3000/api/v1/scans', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com',
        enableAI: true
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify integration with ai-core package
    expect(data.findings[0].explanation).toBeDefined();
    expect(data.findings[0].explanation.length).toBeGreaterThan(50);
  });
});
```

**Run tests:**

```bash
# Test specific app
turbo run test --filter=vibesafe

# Test all apps
turbo run test --filter="./apps/*"
```

**Coverage:** Package + app integration

**Catches:** Breaking changes between packages and consumers

---

### Layer 3: Contract Tests

**Purpose:** Enforce API stability for shared packages

**Location:** In packages that others depend on

**Example:**

```ts
// packages/scanner-core/__tests__/contract.test.ts

import { describe, it, expect } from 'vitest';
import { runScan, calculateGrade } from '../src';
import type { ScanResult, Finding } from '../src/types';

/**
 * CONTRACT TESTS
 *
 * These tests define the public API that all apps depend on.
 * Breaking these tests means breaking all consuming apps!
 */

describe('Scanner Core Public API Contract', () => {
  describe('runScan()', () => {
    it('returns ScanResult with required fields', async () => {
      const result = await runScan('https://example.com');

      // Contract: Must return these exact fields
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('stack');

      // Contract: Types must match
      expect(result.findings).toBeInstanceOf(Array);
      expect(typeof result.grade).toBe('string');
      expect(typeof result.score).toBe('number');
      expect(typeof result.stack).toBe('string');
    });

    it('each Finding has required fields', async () => {
      const result = await runScan('https://example.com');
      const finding = result.findings[0];

      // Contract: Finding shape
      expect(finding).toHaveProperty('moduleId');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('category');
      expect(finding).toHaveProperty('title');
      expect(finding).toHaveProperty('location');
      expect(finding).toHaveProperty('evidence');
      expect(finding).toHaveProperty('explanation');
      expect(finding).toHaveProperty('impact');
      expect(finding).toHaveProperty('fixManual');
      expect(finding).toHaveProperty('fixAiPrompt');

      // Contract: Severity values
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])
        .toContain(finding.severity);
    });
  });

  describe('calculateGrade()', () => {
    it('accepts number (backward compatibility)', () => {
      // Even if we add new signature, old one must work!
      expect(() => calculateGrade(90)).not.toThrow();
      expect(calculateGrade(90)).toMatch(/[A-F]/);
    });

    it('returns valid grade letters', () => {
      const validGrades = ['A', 'B', 'C', 'D', 'F'];
      expect(validGrades).toContain(calculateGrade(95));
      expect(validGrades).toContain(calculateGrade(50));
    });
  });
});
```

**Run tests:**

```bash
# Contract tests run as part of package tests
turbo run test:contract --filter="./packages/*"
```

**Coverage:** Public API contracts

**Catches:** Breaking changes to APIs that apps depend on

---

### Layer 4: End-to-End Tests

**Purpose:** Test real user flows in browser

**Tool:** Playwright

**Location:** In apps

**Example:**

```ts
// apps/vibesafe/__tests__/e2e/scan-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Complete scan flow', () => {
  test('user can scan a URL and view results', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');

    // Enter URL
    await page.fill('[data-testid="url-input"]', 'https://example.com');

    // Start scan
    await page.click('[data-testid="scan-button"]');

    // Wait for scan to complete (up to 60s)
    await page.waitForSelector('[data-testid="scan-complete"]', {
      timeout: 60000,
    });

    // Verify grade displayed
    const grade = await page.textContent('[data-testid="grade"]');
    expect(grade).toMatch(/[A-F]/);

    // Verify findings table
    const findingsTable = page.locator('[data-testid="findings-table"]');
    await expect(findingsTable).toBeVisible();

    // Verify at least one finding row
    const rows = page.locator('[data-testid="finding-row"]');
    await expect(rows.first()).toBeVisible();

    // Click on finding to see details
    await rows.first().click();

    // Verify detail modal opens
    const modal = page.locator('[data-testid="finding-detail-modal"]');
    await expect(modal).toBeVisible();

    // Verify AI explanation present
    const explanation = await modal.locator('[data-testid="explanation"]');
    await expect(explanation).toBeVisible();
  });

  test('user can export PDF report', async ({ page }) => {
    await page.goto('http://localhost:3000/scan/test-scan-id');

    // Wait for results to load
    await page.waitForSelector('[data-testid="scan-complete"]');

    // Click PDF export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-button"]');

    // Verify PDF downloaded
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/vibesafe-report.*\.pdf/);
  });
});
```

**Run tests:**

```bash
# Install Playwright
pnpm add -D @playwright/test

# Run E2E tests
pnpm exec playwright test

# Run with UI
pnpm exec playwright test --ui

# Run specific app
turbo run test:e2e --filter=vibesafe
```

**Coverage:** Real user flows, UI interactions

**Catches:** Integration bugs, UI regressions, workflow issues

---

### Cross-Package Testing Strategy

**Challenge:** How to prevent breaking changes across packages?

**Solution: TypeScript + Integration Tests + Contract Tests**

#### Scenario: Update scanner-core

```ts
// packages/scanner-core/src/grading.ts

// Version 1.0 (original)
export function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  // ...
}

// Developer wants to change to Version 2.0
export function calculateGrade(findings: Finding[]): string {
  const score = calculateScore(findings);
  if (score >= 90) return 'A';
  // ...
}
```

**What happens:**

1. **TypeScript errors immediately:**
   ```bash
   turbo run build

   ❌ apps/vibesafe/app/api/scan.ts:42:25
   Argument of type 'number' is not assignable to parameter of type 'Finding[]'

   ❌ apps/speedcheck/lib/grading.ts:15:30
   Argument of type 'number' is not assignable to parameter of type 'Finding[]'
   ```

2. **Contract tests fail:**
   ```bash
   turbo run test:contract --filter=@repo/scanner-core

   ❌ calculateGrade() accepts number (backward compatibility)
   Expected function not to throw, but it threw TypeError
   ```

3. **Integration tests fail:**
   ```bash
   turbo run test --filter=vibesafe

   ❌ POST /api/v1/scans creates scan and returns valid result
   TypeError: score.reduce is not a function
   ```

4. **CI blocks the PR:**
   ```bash
   GitHub Actions: ❌ Failed

   - Type check: ❌ Failed
   - Unit tests: ✅ Passed
   - Contract tests: ❌ Failed
   - Integration tests: ❌ Failed
   - Build: ❌ Failed
   ```

**Developer must fix ALL apps before merging!**

---

### Test Organization

**Folder structure:**

```
packages/scanner-core/
├── src/
│   ├── index.ts
│   └── grading.ts
├── __tests__/
│   ├── unit/
│   │   └── grading.test.ts      # Unit tests
│   ├── contract/
│   │   └── api.test.ts          # Contract tests
│   └── fixtures/
│       └── mock-data.ts
└── vitest.config.ts

apps/vibesafe/
├── app/
│   └── api/
│       └── scan/route.ts
├── __tests__/
│   ├── unit/
│   │   └── components/
│   ├── integration/
│   │   └── api/
│   │       └── scan.test.ts     # Integration tests
│   └── e2e/
│       └── scan-flow.spec.ts    # E2E tests
└── playwright.config.ts
```

---

### Test Commands

**Package-level:**

```json
// packages/scanner-core/package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run src/__tests__/unit",
    "test:contract": "vitest run src/__tests__/contract",
    "test:coverage": "vitest --coverage"
  }
}
```

**App-level:**

```json
// apps/vibesafe/package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run __tests__/unit",
    "test:integration": "vitest run __tests__/integration",
    "test:e2e": "playwright test",
    "test:all": "vitest && playwright test"
  }
}
```

**Monorepo-level:**

```json
// root package.json
{
  "scripts": {
    "test": "turbo run test",
    "test:packages": "turbo run test --filter='./packages/*'",
    "test:apps": "turbo run test --filter='./apps/*'",
    "test:contract": "turbo run test:contract --filter='./packages/*'",
    "test:e2e": "turbo run test:e2e --filter='./apps/*'",
    "test:all": "turbo run test && turbo run test:e2e"
  }
}
```

---

## 🚀 CI/CD Setup

### GitHub Actions Configuration

**Complete CI/CD pipeline:**

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Job 1: Type check everything
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm run type-check
        # ✅ Catches type errors across all packages/apps

  # Job 2: Lint
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  # Job 3: Test packages
  test-packages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Test packages (unit + contract)
        run: turbo run test --filter='./packages/*'
        # ✅ Tests all shared packages

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./packages/*/coverage

  # Job 4: Test apps (integration tests)
  test-apps:
    runs-on: ubuntu-latest
    needs: [test-packages] # Run after packages tested
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Test apps (integration tests)
        run: turbo run test --filter='./apps/*'
        # ✅ Tests integration between apps + packages

  # Job 5: Build everything
  build:
    runs-on: ubuntu-latest
    needs: [typecheck, lint, test-packages]
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build all apps
        run: turbo run build
        # ✅ Ensures everything compiles

      - name: Cache build artifacts
        uses: actions/cache@v3
        with:
          path: |
            apps/*/. next
            apps/*/dist
          key: ${{ runner.os }}-build-${{ github.sha }}

  # Job 6: E2E tests (optional, run in parallel)
  e2e:
    runs-on: ubuntu-latest
    needs: [build]
    strategy:
      matrix:
        app: [vibesafe, speedcheck]
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests for ${{ matrix.app }}
        run: turbo run test:e2e --filter=${{ matrix.app }}

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-results-${{ matrix.app }}
          path: apps/${{ matrix.app }}/test-results

  # Job 7: Deploy (only on main branch)
  deploy:
    runs-on: ubuntu-latest
    needs: [build, test-apps]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: turbo run build

      - name: Deploy to Vercel
        run: |
          vercel deploy --prod apps/vibesafe
          vercel deploy --prod apps/speedcheck
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

### Preventing Breaking Changes

**Key strategies:**

#### 1. Pre-commit Hooks

```bash
# Install husky
pnpm add -D husky lint-staged

# Initialize husky
npx husky init

# .husky/pre-commit
pnpm run type-check
pnpm run lint
pnpm run test:contract
```

**Prevents committing breaking changes locally**

---

#### 2. Branch Protection Rules

**GitHub settings:**

```yaml
Branch: main
Rules:
  - Require status checks to pass:
    ✅ typecheck
    ✅ lint
    ✅ test-packages
    ✅ test-apps
    ✅ build
  - Require branches to be up to date
  - Require review from 1 person
```

**Prevents merging broken code**

---

#### 3. Changesets for Versioning

```bash
# Install changesets
pnpm add -D @changesets/cli
npx changeset init
```

**Workflow:**

```bash
# Developer changes packages/scanner-core
# Must create changeset

npx changeset

# Prompts:
# Which packages changed? @repo/scanner-core
# What kind of change?
#   - patch (0.0.1 → 0.0.2) - Bug fix
#   - minor (0.1.0 → 0.2.0) - New feature
#   - major (1.0.0 → 2.0.0) - BREAKING CHANGE

# Description: Changed calculateGrade signature

# Creates:
.changeset/clever-panda-123.md
```

**CI enforces changesets:**

```yaml
# .github/workflows/changeset.yml
name: Changesets

on:
  pull_request:
    paths:
      - 'packages/**'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check for changesets
        run: |
          if ! ls .changeset/*.md 2>/dev/null; then
            echo "❌ No changeset found! Run 'npx changeset' to create one."
            exit 1
          fi
```

---

#### 4. Automated Version Bumps

```bash
# When ready to release
npx changeset version

# Auto-updates:
# - Package versions
# - CHANGELOG.md
# - Dependent package versions
```

---

### Testing Best Practices

#### 1. Test Pyramid

```
        E2E (10%)         ← Expensive, slow, critical paths only
       /        \
      /          \
  Integration (30%) ← Moderate cost, key integrations
    /              \
   /                \
Contract (20%)        ← API stability, breaking changes
  /                    \
 /                      \
Unit (40%)               ← Cheap, fast, most coverage
```

**Don't over-invest in E2E tests - they're slow and brittle**

---

#### 2. Test What Matters

**❌ Don't test:**
- Implementation details
- Third-party libraries
- Simple getters/setters

**✅ Do test:**
- Business logic
- Public APIs
- Integration points
- User workflows

---

#### 3. Use Test Fixtures

```ts
// packages/scanner-core/__tests__/fixtures/mock-scan.ts

export const mockScanResult: ScanResult = {
  grade: 'A',
  score: 95,
  findings: [
    {
      moduleId: 'P1-01',
      severity: 'HIGH',
      category: 'Security',
      title: 'API key exposed',
      // ... rest of fields
    },
  ],
  stack: 'Next.js',
};

// Use in tests
import { mockScanResult } from './fixtures/mock-scan';

it('formats scan result', () => {
  const formatted = formatResult(mockScanResult);
  expect(formatted).toBeDefined();
});
```

---

#### 4. Mock External Dependencies

```ts
// apps/vibesafe/__tests__/integration/scan-api.test.ts

import { vi } from 'vitest';

// Mock expensive/flaky external calls
vi.mock('@repo/scanner-core', () => ({
  runScan: vi.fn().mockResolvedValue({
    grade: 'A',
    score: 95,
    findings: [],
  }),
}));

it('handles scan results', async () => {
  // Fast, deterministic test
  const res = await POST(mockRequest);
  expect(res.status).toBe(200);
});
```

---

### Test Coverage Goals

| Layer | Target Coverage | Priority |
|-------|----------------|----------|
| **Packages** | 80-90% | High |
| **Apps (logic)** | 70-80% | Medium |
| **Apps (UI)** | 50-60% | Low |
| **E2E** | Critical paths | Medium |

**Don't chase 100% coverage - focus on high-value tests**

---

### Common Testing Pitfalls

#### ❌ Pitfall 1: Testing Implementation

```ts
// Bad: Testing how it works
it('calls fetch with correct headers', () => {
  const spy = vi.spyOn(global, 'fetch');
  runScan('https://example.com');
  expect(spy).toHaveBeenCalledWith(/* ... */);
});

// Good: Testing what it does
it('returns scan results', async () => {
  const result = await runScan('https://example.com');
  expect(result.grade).toBeDefined();
});
```

---

#### ❌ Pitfall 2: Tightly Coupled Tests

```ts
// Bad: Tests depend on each other
describe('scan flow', () => {
  let scanId: string;

  it('creates scan', () => {
    scanId = createScan(); // Sets global state
  });

  it('gets scan results', () => {
    getResults(scanId); // Depends on previous test
  });
});

// Good: Independent tests
describe('scan flow', () => {
  it('creates scan', () => {
    const scanId = createScan();
    expect(scanId).toBeDefined();
  });

  it('gets scan results', () => {
    const scanId = createScan(); // Setup in each test
    const results = getResults(scanId);
    expect(results).toBeDefined();
  });
});
```

---

#### ❌ Pitfall 3: No Test Isolation

```ts
// Bad: Tests affect each other
beforeAll(() => {
  seedDatabase(); // Shared state
});

it('test 1', () => {
  updateDatabase(); // Modifies shared state
});

it('test 2', () => {
  readDatabase(); // Reads modified state
});

// Good: Clean slate for each test
beforeEach(() => {
  resetDatabase(); // Fresh start
});

afterEach(() => {
  cleanupDatabase(); // Clean up
});
```

---

## 🎯 Decision Framework

### Should You Use a Monorepo?

**Use this decision tree:**

```
START: Do you have multiple related codebases?
│
├─ NO → ❌ Don't use monorepo yet
│        Stay with current setup
│        Revisit when you have 2+ projects
│
└─ YES
   │
   └─ Do they share significant code?
      │
      ├─ NO (< 30% overlap) → ⚠️ Maybe not worth it
      │                        Consider shared npm packages instead
      │
      └─ YES (> 30% overlap)
         │
         └─ Do you have 2+ developers?
            │
            ├─ NO (solo dev) → ⚠️ Probably overkill
            │                   Focus on shipping features
            │                   Revisit when team grows
            │
            └─ YES
               │
               └─ Are you building for multiple platforms?
                  │
                  ├─ NO (web only) → ⚠️ Consider carefully
                  │                   Might be simpler to wait
                  │
                  └─ YES (web + mobile/CLI/etc)
                     │
                     └─ ✅ USE MONOREPO!
                        High value, worth the investment
```

---

### VibeSafe-Specific Recommendations

#### **Scenario 1: Just Starting VibeSafe**

**Status:** MVP stage, no users yet

**Recommendation:** ❌ **Don't use monorepo**

**Why:**
- Premature optimization
- Slows down iteration
- No code reuse yet

**Instead:** Build monolith, get users, validate product

---

#### **Scenario 2: VibeSafe + Planning Mobile App**

**Status:** Web app has traction, want mobile

**Recommendation:** ⚠️ **Start simple, migrate later**

**Approach:**
1. Build mobile app separately (Week 1-2)
2. Copy shared code initially
3. If successful, migrate to monorepo (Week 3-4)

**Why:** Validate mobile demand before infrastructure investment

---

#### **Scenario 3: VibeSafe + Mobile + CLI**

**Status:** 3+ distribution channels planned

**Recommendation:** ✅ **USE MONOREPO**

**Why:**
- 70%+ code reuse (scanner, auth, billing)
- Multiple platforms
- Worth the 2-week setup investment

---

#### **Scenario 4: Building Product Portfolio**

**Status:** Want VibeSafe, SpeedCheck, A11yAudit

**Recommendation:** ✅ **DEFINITELY USE MONOREPO**

**Why:**
- Massive code reuse
- Shared infrastructure
- 3x faster to build new products
- This is THE perfect use case

---

### Migration Paths

#### **Path 1: Gradual Migration (Low Risk)**

**Timeline:** 4-6 weeks

```
Week 1: Setup monorepo structure
        ├─ Move VibeSafe to apps/vibesafe
        └─ Verify it still works

Week 2: Extract first package (scanner-core)
        ├─ Move scanning logic to packages/
        └─ Update VibeSafe to import it

Week 3: Extract more packages (auth, billing)
        └─ Refactor incrementally

Week 4: Build second product (validate architecture)
        └─ SpeedCheck using shared packages

Week 5-6: Polish, optimize, document
```

**Pros:** Low risk, learn as you go

**Cons:** Slower, partial benefits during migration

---

#### **Path 2: Big Bang Migration (Fast)**

**Timeline:** 1-2 weeks

```
Week 1: Setup monorepo + extract all packages
Week 2: Fix issues, test thoroughly
```

**Pros:** Fast, full benefits immediately

**Cons:** Higher risk, blocked if issues arise

**Recommendation:** Only if experienced with monorepos

---

### Common Pitfalls & Solutions

#### Pitfall 1: Over-Abstracting Too Early

**Symptom:**
```
packages/
├── utils/              ← Too generic!
├── helpers/            ← What's the difference?
├── common/             ← Everything goes here
└── shared/             ← Also everything
```

**Solution:** Extract based on domain, not reuse

```
packages/
├── scanner-core/       ✅ Clear domain
├── auth/               ✅ Clear domain
├── billing/            ✅ Clear domain
└── ai-core/            ✅ Clear domain
```

---

#### Pitfall 2: Circular Dependencies

**Symptom:**
```
packages/auth imports packages/db
packages/db imports packages/auth
→ Circular dependency! 😱
```

**Solution:** Create dependency hierarchy

```
packages/db              ← Level 1 (no imports)
packages/auth            ← Level 2 (imports db only)
packages/billing         ← Level 2 (imports db only)
packages/scanner-core    ← Level 3 (imports auth, billing)
apps/*                   ← Level 4 (imports everything)
```

**Rule:** Dependencies flow one direction only

---

#### Pitfall 3: Inconsistent Versioning

**Symptom:**
```
App A uses scanner-core@1.5.0
App B uses scanner-core@2.0.0
→ Different behavior! 😱
```

**Solution:** Use Changesets + workspace protocol

```json
{
  "dependencies": {
    "@repo/scanner-core": "workspace:*"
  }
}
```

**Always use latest version in monorepo**

---

#### Pitfall 4: Slow CI/CD

**Symptom:**
```
CI takes 30 minutes to run
Developers avoid running tests locally
```

**Solution:** Smart caching + selective testing

```yaml
# Only test changed packages
- run: turbo run test --filter='...[HEAD^1]'

# Use remote caching
- run: turbo run build --api="https://cache.vercel.com"
```

---

## ❓ FAQs

### General Questions

**Q: Can I mix Next.js, React Native, and other frameworks?**

A: Yes! That's the power of monorepo. Packages are framework-agnostic.

```
apps/
├── vibesafe-web/       (Next.js)
├── vibesafe-mobile/    (React Native)
├── admin/              (Remix)
└── marketing/          (Astro)

All share packages/scanner-core!
```

---

**Q: How does Turborepo caching work?**

A: Turborepo caches build/test outputs based on inputs (code, dependencies).

```bash
# First run: 8 minutes
turbo run build

# No changes: 5 seconds (cache hit!)
turbo run build

# Change one file: 2 minutes (only rebuild affected)
```

**Caching** is based on:
- File hashes
- Environment variables
- Task configuration

---

**Q: Can I publish packages to npm?**

A: Yes, but consider:
- Make packages standalone (no monorepo dependencies)
- Use standard npm patterns
- Changesets handles versioning

**Most VibeSafe packages should stay private** (internal use only)

---

**Q: What if I want to leave the monorepo later?**

A: Packages are portable:

```bash
# Extract scanner-core to standalone repo
cp -r packages/scanner-core ~/scanner-core-standalone
cd ~/scanner-core-standalone

# Remove monorepo-specific config
rm turbo.json
# Update package.json
# Publish to npm

# Apps can now use npm version
npm install scanner-core
```

---

### VibeSafe-Specific Questions

**Q: Should I build Chrome extension in monorepo?**

A: Yes! Create `apps/vibesafe-extension/`

```
apps/vibesafe-extension/
├── manifest.json
├── src/
│   ├── content-script.ts
│   ├── background.ts
│   └── popup/
└── package.json

# Imports same packages!
import { runScan } from '@repo/scanner-core';
```

---

**Q: How do I handle different environments (dev/staging/prod)?**

A: Use environment variables + feature flags

```bash
# .env.development
VIBESAFE_API_URL=http://localhost:3000
SPEEDCHECK_API_URL=http://localhost:3001

# .env.production
VIBESAFE_API_URL=https://vibesafe.app
SPEEDCHECK_API_URL=https://speedcheck.app
```

**Each app can have its own env vars**

---

**Q: Can I deploy apps independently?**

A: Yes! Vercel/Netlify support monorepo deployments

```yaml
# vercel.json (root)
{
  "projects": [
    {
      "name": "vibesafe",
      "directory": "apps/vibesafe"
    },
    {
      "name": "speedcheck",
      "directory": "apps/speedcheck"
    }
  ]
}
```

**Apps deploy independently on changes**

---

**Q: What about database migrations?**

A: Keep migrations in `packages/db/`

```
packages/db/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── client.ts
└── package.json
```

**All apps share same DB schema**

---

**Q: How do I handle secrets?**

A: Use environment variables + vault

```
# Root .env (never commit!)
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...

# Each app reads from root
import { env } from '@repo/shared/env';
```

**Shared secrets, app-specific configs**

---

### Performance Questions

**Q: Will my builds be slower?**

A: Initially yes, then much faster with caching

```
First build:     8 minutes
Cached build:    30 seconds
Changed file:    2 minutes (incremental)
```

**Turborepo + Remote caching = Fast**

---

**Q: How many packages is too many?**

A: Rule of thumb: 1 package per domain

**VibeSafe:**
- ✅ 8-12 packages (good)
- ⚠️ 20+ packages (getting complex)
- ❌ 50+ packages (too granular)

**Start small, extract when you see duplication**

---

**Q: Can I use Vercel/Netlify remote caching?**

A: Yes!

```bash
# Link to Vercel
turbo link

# Enable remote caching
turbo run build --api="https://vercel.com/api/turborepo"
```

**Team shares cache = Faster CI**

---

## 📚 Resources

### Official Documentation

- [Turborepo](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Changesets](https://github.com/changesets/changesets)

### Example Monorepos

- [Vercel's Turbo](https://github.com/vercel/turbo)
- [Cal.com](https://github.com/calcom/cal.com)
- [T3 App](https://github.com/t3-oss/create-t3-app)

### Tools

- **Turborepo** - Build orchestration
- **pnpm** - Package manager
- **Changesets** - Version management
- **Vitest** - Testing
- **Playwright** - E2E testing

---

## 🎉 Summary

### Key Takeaways

1. **Monorepo = Multiple apps + Shared packages**
2. **70%+ code reuse** across platforms/products
3. **TypeScript prevents breaking changes**
4. **Multi-layered testing** catches issues early
5. **Turborepo caching** makes builds fast
6. **Worth it for:** Multi-platform, multi-product, 2+ devs
7. **Overkill for:** Solo MVP, single product

---

### VibeSafe Roadmap

**Phase 1 (Month 1-2):** Validate web app
- Build monolith
- Get users
- Prove product-market fit

**Phase 2 (Month 3):** Multi-channel
- Chrome extension
- CLI tool
- Shared scanner logic

**Phase 3 (Month 4+):** Monorepo
- Setup Turborepo
- Extract packages
- Build product portfolio

---

### Next Steps

1. ✅ Read this guide
2. ⚠️ Decide: Monorepo now or later?
3. 🚀 If yes: Start with Week 1 setup
4. 📦 Extract scanner-core first
5. 🧪 Setup testing pipeline
6. 🎯 Build second product to validate

---

**Questions?** Review the FAQs or reach out for help!

**Ready to start?** Begin with [Implementation Steps](#implementation-steps) → Week 1!
