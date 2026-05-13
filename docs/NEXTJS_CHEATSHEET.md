# ⚡ Next.js 14 Cheat Sheet

Quick reference for Next.js 14 App Router features. Perfect for React developers learning Next.js!

---

## 🗂️ File Structure

```
src/app/
├── layout.tsx          # Root layout (required)
├── page.tsx            # Homepage (/)
├── loading.tsx         # Loading UI
├── error.tsx           # Error boundary
├── not-found.tsx       # 404 page
│
├── about/
│   └── page.tsx        # /about
│
├── blog/
│   ├── page.tsx        # /blog
│   └── [slug]/
│       └── page.tsx    # /blog/:slug (dynamic)
│
└── api/
    └── users/
        └── route.ts    # API endpoint
```

---

## 🎨 Server vs Client Components

### Server Component (Default)

```typescript
// ✅ Runs on server only
// ✅ Can access database directly
// ✅ Zero JS to browser
// ❌ No hooks (useState, useEffect)
// ❌ No browser APIs

export default async function Page() {
  const data = await prisma.user.findMany();
  return <div>{data.map(...)}</div>;
}
```

### Client Component

```typescript
'use client';  // ← Add this directive

// ✅ Interactive (onClick, onChange)
// ✅ Hooks (useState, useEffect)
// ✅ Browser APIs (localStorage, window)
// ❌ Cannot access database directly

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Rule:** Server by default, Client when you need interactivity.

---

## 🛣️ Routing

### Static Routes

```
src/app/about/page.tsx → /about
src/app/blog/page.tsx → /blog
```

### Dynamic Routes

```
src/app/blog/[slug]/page.tsx → /blog/:slug
src/app/user/[id]/page.tsx → /user/:id
```

### Accessing Params

```typescript
interface Props {
  params: { slug: string };
  searchParams: { q?: string };  // ?q=search
}

export default function Page({ params, searchParams }: Props) {
  return <div>{params.slug}</div>;
}
```

### Catch-All Routes

```
src/app/docs/[...slug]/page.tsx → /docs/a, /docs/a/b, /docs/a/b/c
```

---

## 🔄 API Routes

### Basic GET

```typescript
// src/app/api/hello/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Hello' });
}
```

### POST with Body

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email } = body;
  
  // Validation
  if (!name || !email) {
    return NextResponse.json(
      { error: 'Missing fields' },
      { status: 400 }
    );
  }
  
  // Create user
  const user = await prisma.user.create({ data: { name, email } });
  
  return NextResponse.json(user, { status: 201 });
}
```

### Dynamic API Routes

```typescript
// src/app/api/users/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });
  
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json(user);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
```

### Query Parameters

```typescript
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('q');
  const page = req.nextUrl.searchParams.get('page') || '1';
  
  return NextResponse.json({ search, page });
}
```

### Headers

```typescript
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const ip = req.headers.get('x-forwarded-for');
  
  return NextResponse.json({ auth, ip });
}
```

---

## 📊 Data Fetching

### Server Component (Direct DB)

```typescript
// ✅ Best for SEO, fastest
export default async function Page() {
  const posts = await prisma.post.findMany();
  return <PostList posts={posts} />;
}
```

### Client Component (API)

```typescript
'use client';

import { useEffect, useState } from 'react';

export function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(data => {
        setPosts(data);
        setLoading(false);
      });
  }, []);
  
  if (loading) return <div>Loading...</div>;
  return <PostList posts={posts} />;
}
```

### Fetch with Caching

```typescript
// Revalidate every 60 seconds
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
});

// Never cache
const res = await fetch('https://api.example.com/data', {
  cache: 'no-store'
});

// Cache forever (default)
const res = await fetch('https://api.example.com/data', {
  cache: 'force-cache'
});
```

---

## 📝 Metadata

### Static Metadata

```typescript
export const metadata = {
  title: 'My Page',
  description: 'Page description',
  keywords: ['next.js', 'react'],
};

export default function Page() {
  return <div>Content</div>;
}
```

### Dynamic Metadata

```typescript
export async function generateMetadata({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { id: params.id }
  });

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  };
}
```

---

## 🎨 Layouts

### Root Layout (Required)

```typescript
// src/app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

### Nested Layout

```typescript
// src/app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

---

## 🌍 Environment Variables

### Server-Only (Secret)

```bash
# .env.local
DATABASE_URL="postgresql://..."
API_SECRET="secret123"
STRIPE_SECRET_KEY="sk_test_..."
```

```typescript
// ✅ Server Components & API Routes only
const secret = process.env.API_SECRET;
```

### Client-Side (Public)

```bash
# .env.local
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_FEATURE_ENABLED="true"
```

```typescript
// ✅ Available in Client Components
'use client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

**🚨 Never put secrets in `NEXT_PUBLIC_*` variables!**

---

## 🔧 Common Patterns

### Loading State

```typescript
// src/app/posts/loading.tsx
export default function Loading() {
  return <Spinner />;
}
```

### Error Handling

```typescript
// src/app/posts/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 404 Not Found

```typescript
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
    </div>
  );
}
```

### Redirects

```typescript
import { redirect } from 'next/navigation';

export default async function Page() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return <div>Welcome {user.name}</div>;
}
```

### Custom Hooks (Client)

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(setUser);
  }, []);

  return user;
}
```

---

## 🎯 TypeScript Tips

### Page Props

```typescript
interface PageProps {
  params: { id: string };
  searchParams: { q?: string };
}

export default function Page({ params, searchParams }: PageProps) {
  // ...
}
```

### API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ data: 'hello' });
}
```

### Component Props

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ children, onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{children}</button>;
}
```

---

## 🚀 Common Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

---

## 📦 Import Aliases

```typescript
// With path aliases (@/*)
import { Button } from '@/components/button';
import { prisma } from '@/lib/prisma';
import type { User } from '@/types';

// Instead of:
import { Button } from '../../../components/button';
```

---

## ⚠️ Common Mistakes

### 1. Using hooks in Server Components

```typescript
// ❌ WRONG
export default function Page() {
  const [count, setCount] = useState(0);  // Error!
  return <div>{count}</div>;
}

// ✅ CORRECT
'use client';

export default function Page() {
  const [count, setCount] = useState(0);  // Works!
  return <div>{count}</div>;
}
```

### 2. Importing Server code in Client

```typescript
// ❌ WRONG
'use client';
import { prisma } from '@/lib/prisma';  // Error!

// ✅ CORRECT - Use API route
'use client';
const data = await fetch('/api/data');
```

### 3. Forgetting async in Server Components

```typescript
// ❌ WRONG
export default function Page() {
  const data = await fetch('...');  // Error!
}

// ✅ CORRECT
export default async function Page() {
  const data = await fetch('...');  // Works!
}
```

### 4. Exposing secrets

```bash
# ❌ WRONG
NEXT_PUBLIC_STRIPE_SECRET="sk_live_..."

# ✅ CORRECT
STRIPE_SECRET_KEY="sk_live_..."
```

---

## 🔥 Pro Tips

1. **Default to Server Components** - Only use Client when needed
2. **Direct DB access in Server Components** - No API route needed
3. **Use TypeScript** - Catch errors early
4. **Feature flags** - Use env vars for toggles
5. **Path aliases** - Use `@/*` imports
6. **Error boundaries** - Add error.tsx files
7. **Loading states** - Add loading.tsx files
8. **Metadata** - Always add for SEO

---

## 📚 Quick Links

- [Next.js Docs](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)
- [API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

**Keep this handy while coding! 🚀**
