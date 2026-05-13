# 🚀 Next.js Learning Guide for React Developers

Welcome! This guide highlights the key Next.js 14 features and patterns you can learn from the **VibeSafe** project. If you're coming from React, this will help you understand what's new and different.

---

## 📚 Table of Contents

1. [App Router vs Pages Router](#1-app-router-vs-pages-router)
2. [Server Components vs Client Components](#2-server-components-vs-client-components)
3. [File-Based Routing](#3-file-based-routing)
4. [API Routes](#4-api-routes)
5. [Layouts and Templates](#5-layouts-and-templates)
6. [Metadata API](#6-metadata-api)
7. [Data Fetching](#7-data-fetching)
8. [Client-Side Features](#8-client-side-features)
9. [Environment Variables](#9-environment-variables)
10. [TypeScript Configuration](#10-typescript-configuration)
11. [Next.js Config](#11-nextjs-config)
12. [Deployment](#12-deployment)

---

## 1. App Router vs Pages Router

**What is it?**  
Next.js 14 uses the **App Router** (introduced in Next.js 13), which replaces the older Pages Router. It's built on React Server Components.

**Key Differences:**
| Pages Router (Old) | App Router (New) |
|--------------------|------------------|
| `pages/` directory | `src/app/` directory |
| `getServerSideProps`, `getStaticProps` | Direct async/await in components |
| Client-side by default | Server-side by default |
| `_app.js` for layout | `layout.tsx` for nested layouts |

**Where to see it in this project:**
- The entire app uses the **App Router** (`src/app/`)
- Files like `src/app/layout.tsx`, `src/app/page.tsx` are App Router specific

---

## 2. Server Components vs Client Components

**🔥 The biggest change from React!**

### Server Components (Default)

**What are they?**  
Components that run **only on the server**. They can directly access databases, APIs, and file systems without exposing secrets to the browser.

**Benefits:**
- ✅ Zero JavaScript sent to the browser (faster page loads)
- ✅ Direct database access (no API layer needed)
- ✅ Better SEO (fully rendered HTML)
- ✅ Secure environment variables

**Example from this project:**

```typescript
// src/app/report/[id]/page.tsx
// This is a Server Component (default in app/)
export default async function ReportPage({ params }: Props) {
  // ✅ Direct Prisma query on the server
  const scanData = await getReportData(params.id);
  
  return <ReportView scanData={scanData} />;
}

async function getReportData(id: string): Promise<ScanData> {
  // ✅ Direct database access - no API route needed!
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { findings: true },
  });
  
  return scan;
}
```

### Client Components

**What are they?**  
Components that run **in the browser**. They use React hooks (useState, useEffect) and handle interactivity.

**When to use:**
- ❌ Cannot directly access databases
- ✅ Need useState, useEffect, event handlers
- ✅ Need browser APIs (localStorage, window)
- ✅ Need third-party libraries that use browser APIs

**How to create:**  
Add `'use client'` at the top of the file.

**Example from this project:**

```typescript
// src/components/auth-button.tsx
'use client';  // ← This makes it a Client Component

import { signIn, signOut, useSession } from 'next-auth/react';
import { useFeature } from '@/lib/client-features';

export function AuthButton() {
  const authEnabled = useFeature('auth');
  const { data: session } = useSession(); // ← Hooks only work in Client Components
  
  return (
    <button onClick={() => signIn()}>Sign In</button>
  );
}
```

**🎯 Rule of Thumb:**
- Default to Server Components
- Only use `'use client'` when you need interactivity or browser APIs

---

## 3. File-Based Routing

**What is it?**  
Routes are automatically created based on your folder structure in `src/app/`.

### Special Files

| File | Purpose | Example |
|------|---------|---------|
| `page.tsx` | Defines a route | `app/page.tsx` → `/` |
| `layout.tsx` | Shared UI wrapper | `app/layout.tsx` wraps all pages |
| `loading.tsx` | Loading UI | Shows while page loads |
| `error.tsx` | Error boundary | Catches errors |
| `not-found.tsx` | 404 page | Custom 404 |

### Dynamic Routes

Use square brackets `[param]` for dynamic segments.

**Examples from this project:**

```
src/app/
├── page.tsx                    → / (homepage)
├── layout.tsx                  → Root layout
├── report/
│   └── [id]/
│       └── page.tsx           → /report/:id (dynamic)
├── scan/
│   └── [id]/
│       └── page.tsx           → /scan/:id (dynamic)
├── api/
│   └── v1/
│       └── scans/
│           ├── route.ts       → /api/v1/scans (API route)
│           └── [id]/
│               └── route.ts   → /api/v1/scans/:id (dynamic API)
```

**Accessing params:**

```typescript
// src/app/report/[id]/page.tsx
interface Props {
  params: { id: string };        // ← Route params
  searchParams: { url?: string }; // ← Query params (?url=...)
}

export default async function ReportPage({ params, searchParams }: Props) {
  const scanId = params.id;  // From /report/abc123
  const url = searchParams.url; // From ?url=example.com
}
```

---

## 4. API Routes

**What are they?**  
Backend API endpoints defined in the `app/api/` directory.

### Route Handlers

Use `route.ts` files with HTTP method exports: `GET`, `POST`, `PUT`, `DELETE`, etc.

**Example from this project:**

```typescript
// src/app/api/v1/scans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  // ✅ Parse request body
  const body = await req.json();
  const { url } = body;

  // ✅ Access headers
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  // ✅ Direct database access in API route
  const scan = await prisma.scan.create({
    data: { targetUrl: url, requesterIp: ip },
  });

  // ✅ Return JSON response
  return NextResponse.json(
    { id: scan.id, status: scan.status },
    { status: 201 }
  );
}
```

**Dynamic API Routes:**

```typescript
// src/app/api/v1/scans/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
  });

  return NextResponse.json(scan);
}
```

---

## 5. Layouts and Templates

**What are they?**
`layout.tsx` files wrap multiple pages and persist state across navigation.

### Root Layout (Required)

Every app needs a root layout at `app/layout.tsx`.

**Example from this project:**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

// ✅ Static metadata
export const metadata: Metadata = {
  title: 'VibeSafe — Security scanner for AI-built sites',
  description: 'Paste a URL. Get a security report in 90 seconds.',
};

// ✅ This wraps ALL pages in your app
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Key Features:**
- ✅ Wraps all child pages
- ✅ Persists across navigation (no re-render)
- ✅ Can be nested (create layouts in subdirectories)
- ✅ Must include `<html>` and `<body>` tags

---

## 6. Metadata API

**What is it?**
Built-in SEO optimization through static or dynamic metadata.

### Static Metadata

```typescript
// Simple metadata export
export const metadata = {
  title: 'My Page',
  description: 'My page description',
};
```

### Dynamic Metadata

**Example from this project:**

```typescript
// src/app/demo/accessibility/page.tsx
export const metadata = {
  title: 'Accessibility Demo | VibeSafe',
  description: 'Demo of WCAG 2.2 Level AA accessibility scanning',
};
```

**For dynamic routes:**

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const scan = await prisma.scan.findUnique({ where: { id: params.id } });

  return {
    title: `${scan.targetUrl} - Security Report`,
    description: `Security scan results for ${scan.targetUrl}`,
  };
}
```

---

## 7. Data Fetching

**The biggest difference from React!**

### In React:
```jsx
// ❌ Old way: useEffect + fetch
function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{data?.name}</div>;
}
```

### In Next.js Server Components:
```typescript
// ✅ New way: Direct async/await
async function Component() {
  const data = await fetch('https://api.example.com/data');
  const json = await data.json();

  return <div>{json.name}</div>;
}
```

### Direct Database Access

**Example from this project:**

```typescript
// src/app/report/[id]/page.tsx
async function getReportData(id: string): Promise<ScanData> {
  // ✅ Direct Prisma query - no API route needed!
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { findings: true },
  });

  if (!scan) throw new Error('Report not found.');

  return {
    id: scan.id,
    url: scan.targetUrl,
    findings: scan.findings,
  };
}

export default async function ReportPage({ params }: Props) {
  const scanData = await getReportData(params.id);
  return <ReportView scanData={scanData} />;
}
```

**Benefits:**
- ✅ No loading states needed
- ✅ No useEffect
- ✅ Better performance (server-rendered)
- ✅ SEO-friendly

---

## 8. Client-Side Features

### When to Use Client Components

**Example 1: Interactive Forms**

```typescript
// Likely in src/app/landing-hero.tsx
'use client';

import { useState } from 'react';

export function LandingHero() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/v1/scans', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    router.push(`/scan/${data.id}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={url} onChange={(e) => setUrl(e.target.value)} />
      <button disabled={loading}>Scan Now</button>
    </form>
  );
}
```

**Example 2: Third-Party Libraries**

```typescript
// src/components/providers.tsx
'use client';  // ← NextAuth requires client component

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Example 3: Hooks & Effects**

```typescript
// src/components/performance-section.tsx
'use client';

import { useEffect, useState } from 'react';

export function PerformanceSection({ scanId }: Props) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSuggestions() {
      const res = await fetch(`/api/v1/scans/${scanId}/performance-suggestions`);
      const data = await res.json();
      setSuggestions(data);
      setLoading(false);
    }
    fetchSuggestions();
  }, [scanId]);

  return loading ? <Spinner /> : <div>{suggestions}</div>;
}
```

---

## 9. Environment Variables

Next.js has special handling for environment variables.

### Server-Only Variables

```bash
# .env.local
DATABASE_URL="postgresql://..."
STRIPE_SECRET_KEY="sk_test_..."
SENTRY_DSN="https://..."
```

Access in Server Components and API Routes:
```typescript
const dbUrl = process.env.DATABASE_URL;
const stripeKey = process.env.STRIPE_SECRET_KEY;
```

### Client-Side Variables

Prefix with `NEXT_PUBLIC_`:

```bash
# .env.local
NEXT_PUBLIC_STRIPE_ENABLED="true"
NEXT_PUBLIC_AUTH_ENABLED="true"
NEXT_PUBLIC_PDF_EXPORT_ENABLED="true"
```

Access in Client Components:
```typescript
// src/lib/client-features.ts
export const clientFeatures = {
  stripe: parseBool(process.env.NEXT_PUBLIC_STRIPE_ENABLED),
  auth: parseBool(process.env.NEXT_PUBLIC_AUTH_ENABLED),
  pdfExport: parseBool(process.env.NEXT_PUBLIC_PDF_EXPORT_ENABLED),
};
```

**🚨 Security:**
- ✅ Never put secrets in `NEXT_PUBLIC_*` variables (they're exposed to the browser!)
- ✅ Only use `NEXT_PUBLIC_*` for non-sensitive config

---

## 10. TypeScript Configuration

Next.js has excellent TypeScript support out of the box.

**Example from this project:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]  // ← Path alias for imports
    }
  }
}
```

**Path Aliases:**

```typescript
// ✅ Instead of: import { Nav } from '../../../components/nav';
import { Nav } from '@/components/nav';

// ✅ Instead of: import { prisma } from '../../lib/prisma';
import { prisma } from '@/lib/prisma';
```

---

## 11. Next.js Config

Configure Next.js behavior in `next.config.mjs`.

**Example from this project:**

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,  // Disable source maps in production

  output: 'standalone',  // Enable for Docker deployment

  webpack(config, { dev, isServer }) {
    if (dev) {
      config.optimization.minimize = false;  // Faster dev builds
    }

    // Suppress warnings
    if (isServer) {
      config.ignoreWarnings = [
        {
          module: /node_modules\/@opentelemetry/,
          message: /Critical dependency/,
        },
      ];
    }

    return config;
  },
};

export default nextConfig;
```

**Common Config Options:**
- `output: 'standalone'` - For Docker/self-hosting
- `images` - Configure image optimization
- `redirects()` - Set up redirects
- `headers()` - Add custom headers
- `env` - Inject environment variables

---

## 12. Deployment

Next.js apps can be deployed to Vercel (easiest) or self-hosted.

### Vercel Deployment

**Example from this project:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy
```

**Environment Variables:**
Set in Vercel dashboard or via CLI:
```bash
vercel env add DATABASE_URL
vercel env add STRIPE_SECRET_KEY
```

### Self-Hosting (Docker)

The project includes Docker support:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

**Run with Docker Compose:**
```bash
docker-compose up
```

---

## 🎯 Key Patterns to Study in This Project

### 1. **Dynamic Routes with Database Queries**
Look at: `src/app/report/[id]/page.tsx`
- Learn how to fetch data on the server for dynamic routes

### 2. **API Routes with Prisma**
Look at: `src/app/api/v1/scans/route.ts`
- Learn how to build REST APIs with Next.js

### 3. **Client/Server Component Separation**
Compare:
- `src/app/report/[id]/page.tsx` (Server Component)
- `src/components/auth-button.tsx` (Client Component)

### 4. **Feature Flags**
Look at: `src/lib/client-features.ts`
- Learn how to conditionally enable features

### 5. **Authentication with NextAuth**
Look at:
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/lib/auth/nextauth-config.ts`
- `src/components/providers.tsx`

### 6. **Environment-Based Configuration**
Look at: `src/lib/features.ts`
- Learn how to configure features via environment variables

### 7. **Type-Safe API Responses**
Look at: `src/types/index.ts`
- Learn how to share types between client and server

---

## 📖 Additional Resources

### Official Documentation
- [Next.js 14 Docs](https://nextjs.org/docs)
- [App Router Documentation](https://nextjs.org/docs/app)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

### Learn by Doing
1. **Start with the homepage:** `src/app/page.tsx`
2. **Follow the flow:** Submit URL → API route → Scan page → Report page
3. **Modify components:** Add new features to existing components
4. **Experiment:** Convert a Server Component to Client Component and vice versa

---

## 🚀 Quick Start Checklist

- [ ] Read about App Router vs Pages Router
- [ ] Understand Server vs Client Components (`'use client'`)
- [ ] Study the file-based routing structure (`src/app/`)
- [ ] Look at API routes (`src/app/api/`)
- [ ] Examine the root layout (`src/app/layout.tsx`)
- [ ] Review environment variable usage
- [ ] Explore how Prisma is used in Server Components
- [ ] Check out NextAuth setup for authentication
- [ ] Look at the Next.js config (`next.config.mjs`)
- [ ] Run the app locally and experiment!

---

## 💡 Common Gotchas

### 1. **Forgetting `'use client'`**
```typescript
// ❌ This will error in a Server Component
export function MyComponent() {
  const [state, setState] = useState(0);  // Error: useState only works in Client Components
  return <div>{state}</div>;
}

// ✅ Add 'use client' directive
'use client';

export function MyComponent() {
  const [state, setState] = useState(0);  // Now it works!
  return <div>{state}</div>;
}
```

### 2. **Using Client-Only APIs in Server Components**
```typescript
// ❌ Server Components can't access window, localStorage, etc.
export default function Page() {
  const token = localStorage.getItem('token');  // Error!
  return <div>{token}</div>;
}

// ✅ Use in Client Component instead
'use client';

export function TokenDisplay() {
  const token = localStorage.getItem('token');  // Works!
  return <div>{token}</div>;
}
```

### 3. **Importing Server Code in Client Components**
```typescript
// ❌ Don't import Prisma in Client Components
'use client';

import { prisma } from '@/lib/prisma';  // Error!

export function MyComponent() {
  // This won't work
}

// ✅ Use API routes instead
'use client';

export function MyComponent() {
  const data = await fetch('/api/data');  // Call API route
}
```

### 4. **Exposing Secrets via Environment Variables**
```bash
# ❌ WRONG - Anyone can see this in the browser!
NEXT_PUBLIC_STRIPE_SECRET_KEY="sk_live_..."

# ✅ CORRECT - Only on server
STRIPE_SECRET_KEY="sk_live_..."

# ✅ CORRECT - Non-sensitive config for browser
NEXT_PUBLIC_STRIPE_ENABLED="true"
```

---

## 🎓 Next Steps

1. **Clone and run the project:**
   ```bash
   npm install
   npm run dev
   ```

2. **Explore the codebase:**
   - Start with `src/app/page.tsx`
   - Follow the user flow through the app
   - Read the comments in the code

3. **Make small changes:**
   - Add a new page
   - Create an API route
   - Build a new component

4. **Build something new:**
   - Add a new feature
   - Create a new module
   - Experiment with Server/Client Components

---

**Happy Learning! 🚀**

Built with Next.js 14, TypeScript, Prisma, and Tailwind CSS.
