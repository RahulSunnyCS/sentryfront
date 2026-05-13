# 🎯 Next.js Hands-On Exercises

Practice exercises to help you learn Next.js 14 by working with the VibeSafe codebase.

---

## 🌟 Beginner Exercises

### Exercise 1: Create a Simple Static Page

**Goal:** Learn basic Next.js routing and Server Components

**Task:**  
Create a new "About" page at `/about` that displays information about VibeSafe.

**Steps:**
1. Create `src/app/about/page.tsx`
2. Export a default React component
3. Add some static content
4. Visit `http://localhost:3000/about`

**Example Solution:**
```typescript
// src/app/about/page.tsx
export default function AboutPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>About VibeSafe</h1>
      <p>VibeSafe is a security scanner for AI-built sites.</p>
    </div>
  );
}
```

**What you learned:**
- ✅ File-based routing
- ✅ Server Components (default)
- ✅ No need for imports or routing config

---

### Exercise 2: Add Metadata to Your Page

**Goal:** Learn the Metadata API

**Task:**  
Add SEO metadata to the About page you created.

**Steps:**
1. Export a `metadata` object from your page
2. Include title and description
3. Check the browser tab title

**Example Solution:**
```typescript
// src/app/about/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | VibeSafe',
  description: 'Learn about VibeSafe security scanning',
};

export default function AboutPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>About VibeSafe</h1>
      <p>VibeSafe is a security scanner for AI-built sites.</p>
    </div>
  );
}
```

**What you learned:**
- ✅ Static metadata export
- ✅ TypeScript types for metadata
- ✅ SEO optimization built-in

---

### Exercise 3: Create a Client Component

**Goal:** Understand the difference between Server and Client Components

**Task:**  
Create a counter component that increments when clicked.

**Steps:**
1. Create `src/components/counter.tsx`
2. Add `'use client'` directive
3. Use `useState` hook
4. Import and use it in your About page

**Example Solution:**
```typescript
// src/components/counter.tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

```typescript
// src/app/about/page.tsx
import { Counter } from '@/components/counter';

export default function AboutPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>About VibeSafe</h1>
      <Counter />
    </div>
  );
}
```

**What you learned:**
- ✅ `'use client'` directive
- ✅ Client Components can use hooks
- ✅ Server Components can import Client Components

---

### Exercise 4: Create a Dynamic Route

**Goal:** Learn dynamic routing with parameters

**Task:**  
Create a route that displays different messages based on a URL parameter.

**Steps:**
1. Create `src/app/hello/[name]/page.tsx`
2. Access the `name` parameter from props
3. Display a personalized greeting
4. Test with `/hello/john`, `/hello/jane`, etc.

**Example Solution:**
```typescript
// src/app/hello/[name]/page.tsx
interface Props {
  params: { name: string };
}

export default function HelloPage({ params }: Props) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Hello, {params.name}!</h1>
      <p>Welcome to VibeSafe.</p>
    </div>
  );
}
```

**What you learned:**
- ✅ Dynamic routes with `[param]` syntax
- ✅ Accessing route parameters
- ✅ TypeScript props interface

---

## 🔥 Intermediate Exercises

### Exercise 5: Build a Simple API Route

**Goal:** Learn Next.js API routes

**Task:**  
Create an API endpoint that returns the current time.

**Steps:**
1. Create `src/app/api/time/route.ts`
2. Export a `GET` function
3. Return JSON with current timestamp
4. Test with `http://localhost:3000/api/time`

**Example Solution:**
```typescript
// src/app/api/time/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date().toISOString();

  return NextResponse.json({
    time: now,
    timestamp: Date.now(),
  });
}
```

**What you learned:**
- ✅ API Route handlers
- ✅ HTTP method exports (GET, POST, etc.)
- ✅ NextResponse for JSON responses

---

### Exercise 6: Fetch Data from Your API in a Client Component

**Goal:** Learn client-side data fetching

**Task:**
Create a component that fetches and displays the current time from your API.

**Steps:**
1. Create a Client Component with `'use client'`
2. Use `useEffect` and `useState`
3. Fetch from `/api/time`
4. Display the result

**Example Solution:**
```typescript
// src/components/current-time.tsx
'use client';

import { useEffect, useState } from 'react';

export function CurrentTime() {
  const [time, setTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTime() {
      const res = await fetch('/api/time');
      const data = await res.json();
      setTime(data.time);
      setLoading(false);
    }

    fetchTime();
  }, []);

  if (loading) return <p>Loading...</p>;

  return <p>Current time: {time}</p>;
}
```

**What you learned:**
- ✅ useEffect for data fetching
- ✅ useState for loading states
- ✅ Fetching from API routes

---

### Exercise 7: Add Query Parameters Support

**Goal:** Learn to work with query parameters

**Task:**
Modify your time API to support timezone query parameter.

**Steps:**
1. Read query parameters from the request
2. Use the timezone parameter (or default to UTC)
3. Test with `/api/time?timezone=America/New_York`

**Example Solution:**
```typescript
// src/app/api/time/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Get query parameter
  const timezone = req.nextUrl.searchParams.get('timezone') || 'UTC';

  const now = new Date().toLocaleString('en-US', {
    timeZone: timezone
  });

  return NextResponse.json({
    time: now,
    timezone: timezone,
  });
}
```

**What you learned:**
- ✅ Reading query parameters
- ✅ NextRequest API
- ✅ URL search params

---

### Exercise 8: Server Component with Database Query

**Goal:** Learn server-side data fetching with Prisma

**Task:**
Create a page that displays the count of all scans in the database.

**Steps:**
1. Create `src/app/stats/page.tsx`
2. Query Prisma directly in the component
3. Display the count

**Example Solution:**
```typescript
// src/app/stats/page.tsx
import { prisma } from '@/lib/prisma';

async function getStats() {
  const totalScans = await prisma.scan.count();
  const completedScans = await prisma.scan.count({
    where: { status: 'COMPLETED' },
  });

  return { totalScans, completedScans };
}

export default async function StatsPage() {
  const stats = await getStats();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>VibeSafe Statistics</h1>
      <p>Total Scans: {stats.totalScans}</p>
      <p>Completed: {stats.completedScans}</p>
    </div>
  );
}
```

**What you learned:**
- ✅ Async Server Components
- ✅ Direct database access (no API needed!)
- ✅ Prisma queries in components

---

### Exercise 9: POST API Route with Validation

**Goal:** Learn to handle POST requests and validate input

**Task:**
Create an API that accepts a name and returns a greeting.

**Steps:**
1. Create `src/app/api/greet/route.ts`
2. Export a `POST` function
3. Parse and validate the request body
4. Return a personalized greeting or error

**Example Solution:**
```typescript
// src/app/api/greet/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name } = body;

  // Validation
  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { error: 'Name is required and must be a string' },
      { status: 400 }
    );
  }

  if (name.length > 50) {
    return NextResponse.json(
      { error: 'Name is too long (max 50 characters)' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: `Hello, ${name}! Welcome to VibeSafe.`,
  });
}
```

**What you learned:**
- ✅ POST request handling
- ✅ Request body parsing
- ✅ Input validation
- ✅ Error responses with status codes

---

## 🚀 Advanced Exercises

### Exercise 10: Feature Flag Implementation

**Goal:** Learn environment-based feature flags

**Task:**
Create a feature flag system for a new "Comments" feature.

**Steps:**
1. Add `NEXT_PUBLIC_COMMENTS_ENABLED=true` to `.env.local`
2. Update `src/lib/client-features.ts`
3. Create a component that only shows when enabled
4. Toggle the flag and see the change

**Example Solution:**
```typescript
// src/lib/client-features.ts
const parseBool = (val?: string) => val === 'true';

export const clientFeatures = {
  // Existing features...
  comments: parseBool(process.env.NEXT_PUBLIC_COMMENTS_ENABLED),
} as const;
```

```typescript
// src/components/comments-section.tsx
'use client';

import { useFeature } from '@/lib/client-features';

export function CommentsSection() {
  const commentsEnabled = useFeature('comments');

  if (!commentsEnabled) {
    return null;
  }

  return (
    <div>
      <h3>Comments</h3>
      <p>Comments feature is enabled!</p>
    </div>
  );
}
```

**What you learned:**
- ✅ Environment variables in Next.js
- ✅ Feature flags pattern
- ✅ Conditional rendering based on config

---

### Exercise 11: Dynamic Metadata Generation

**Goal:** Learn to generate metadata dynamically

**Task:**
Create a page with dynamic metadata based on route parameters.

**Steps:**
1. Create `src/app/user/[id]/page.tsx`
2. Export `generateMetadata` function
3. Fetch user data (mock or from DB)
4. Return dynamic metadata

**Example Solution:**
```typescript
// src/app/user/[id]/page.tsx
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch user data
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    return {
      title: 'User Not Found',
    };
  }

  return {
    title: `${user.name} | VibeSafe`,
    description: `Profile page for ${user.name}`,
  };
}

export default async function UserPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
  });

  if (!user) {
    return <p>User not found</p>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

**What you learned:**
- ✅ generateMetadata function
- ✅ Dynamic SEO optimization
- ✅ Async metadata generation

---

## 📚 Real-World Project Challenges

### Challenge 1: Build a "Recent Scans" Page

**Requirements:**
- Create `/recent-scans` route
- Fetch the 10 most recent scans from database
- Display them in a table with: URL, Date, Grade, Status
- Make it a Server Component (no loading state!)
- Add pagination (bonus)

**Hints:**
- Study `src/app/report/[id]/page.tsx` for Prisma examples
- Use `orderBy` in Prisma query
- Look at existing components for styling

---

### Challenge 2: Add a Search API

**Requirements:**
- Create `/api/search` endpoint
- Accept `?q=` query parameter
- Search scans by target URL (case-insensitive)
- Return matching scans
- Add proper error handling

**Hints:**
- Look at `src/app/api/v1/scans/route.ts`
- Use Prisma's `contains` filter
- Test with `/api/search?q=example.com`

---

### Challenge 3: Build a Client-Side Dashboard

**Requirements:**
- Create `/dashboard` page
- Fetch scan stats from an API
- Show charts/stats (can be simple HTML)
- Add a refresh button
- Handle loading and error states

**Hints:**
- Must be a Client Component (`'use client'`)
- Use useState and useEffect
- Look at `src/components/performance-section.tsx` for patterns

---

## 🎓 Learning Path

**Week 1: Basics**
- [ ] Complete exercises 1-4
- [ ] Read the official Next.js App Router docs
- [ ] Explore the VibeSafe codebase structure

**Week 2: Intermediate**
- [ ] Complete exercises 5-9
- [ ] Build a simple CRUD feature
- [ ] Study the authentication flow

**Week 3: Advanced**
- [ ] Complete exercises 10-11
- [ ] Work on real-world challenges
- [ ] Contribute a new feature to VibeSafe

---

## 💡 Tips for Success

1. **Start Small:** Don't try to understand everything at once
2. **Read Error Messages:** Next.js has helpful error messages
3. **Use TypeScript:** Let types guide you
4. **Check the Browser Console:** See what's happening client-side
5. **Check the Terminal:** See server-side logs
6. **Experiment:** Break things and fix them!

---

**Happy Coding! 🎉**
