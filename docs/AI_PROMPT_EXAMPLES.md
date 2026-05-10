# AI Coding Assistant Prompt Examples

This document contains **ready-to-use prompts** for AI coding assistants (ChatGPT, Claude, Copilot, Cursor, Augment) to help you improve your website based on VibeSafe scan results.

---

## 🎯 **How to Use This Guide**

1. **Run a VibeSafe scan** on your website
2. **Get the scan ID** from the results
3. **Fetch AI-ready prompts** using the Performance Suggestions API:
   ```bash
   curl -s https://your-vibesafe.com/api/v1/scans/SCAN_ID/performance-suggestions \
     | jq -r '.aiPromptBundle'
   ```
4. **Copy the output** and paste it into your AI coding assistant
5. **Get specific code examples** and implementation guidance

---

## 📋 **Example Prompts**

### **1. Comprehensive Performance Optimization**

```markdown
# Performance Optimization Request

## Current Performance
- **Grade**: B
- **Lighthouse Score**: 83/100
- **LCP**: 1.70s (target: <2.0s)
- **CLS**: 0.023 (target: <0.08)
- **TBT**: 638ms (target: <200ms)
- **FCP**: 1.54s (target: <1.5s)
- **TTFB**: 1ms (target: <600ms)

## Issues to Fix (Priority Order)

### 1. Remove unused JavaScript and implement code splitting [HIGH]
**Category**: JavaScript  
**Impact**: Improve FCP by 0.3-1s, reduce TBT by 200-500ms  
**Effort**: Medium (1-4 hours)

**Action**:
I have 547 KB of unused JavaScript. Implement code splitting, remove dead code, and lazy load non-critical features.

### 2. Reduce Total Blocking Time (TBT): 638ms [HIGH]
**Category**: JavaScript Performance  
**Impact**: Improve interactivity, faster Time to Interactive  
**Effort**: Medium (1-4 hours)

**Action**:
My TBT is 638ms (target <200ms). Split long tasks, defer third-party scripts, reduce JavaScript execution time, use web workers for heavy computations.

## Instructions
Please help me implement these improvements. Start with Quick Wins for immediate impact, then tackle major improvements. Provide code examples and configuration changes where applicable.

## My Tech Stack
- Framework: Next.js 14 / React / Vue / etc.
- Hosting: Vercel / Netlify / AWS / etc.
- Build Tool: Webpack / Vite / Turbopack / etc.
```

---

### **2. Specific Issue: Image Optimization**

```markdown
I need to optimize images on my website. VibeSafe detected:
- 850 KB of images in JPEG/PNG format
- Could save 25-50% by converting to WebP/AVIF
- Impact: Improve LCP by 0.5-2s

My setup:
- Framework: Next.js 14
- Images stored in: /public/images
- Currently using: <img> tags

Please help me:
1. Convert existing images to WebP/AVIF
2. Implement <picture> elements with fallbacks
3. Set up automatic image optimization in Next.js
4. Add lazy loading for below-fold images
```

---

### **3. Specific Issue: Code Splitting**

```markdown
VibeSafe detected 547 KB of unused JavaScript on my landing page.

My setup:
- Framework: Next.js 14 with App Router
- Heavy dependencies: Chart.js, Framer Motion, Markdown parser
- Problem: Loading all dependencies upfront

Please help me:
1. Analyze which dependencies are unused on the landing page
2. Implement dynamic imports for heavy components
3. Set up route-based code splitting
4. Lazy load modals, charts, and non-critical features
5. Show me how to verify bundle size reduction
```

---

### **4. Specific Issue: Cumulative Layout Shift (CLS)**

```markdown
My website has a CLS score of 0.15 (target: <0.08).

Common causes on my site:
- Images without width/height attributes
- Ads inserted dynamically
- Fonts loading late causing text reflow

My setup:
- Framework: Next.js 14
- Using Google Fonts
- Third-party ads: Google AdSense

Please help me:
1. Add explicit width/height to all images
2. Reserve space for ads before they load
3. Optimize font loading to prevent FOUT/FOIT
4. Add CSS to prevent layout shifts
```

---

### **5. Specific Issue: Total Blocking Time (TBT)**

```markdown
My TBT is 638ms (target: <200ms). This is blocking interactivity.

My setup:
- Framework: React 18 with Webpack
- Heavy third-party scripts: Google Analytics, Intercom, HubSpot
- Large component trees rendering on mount

Please help me:
1. Defer third-party scripts until after page load
2. Split long tasks into smaller chunks
3. Use requestIdleCallback for non-critical work
4. Implement web workers for heavy computations
5. Optimize React rendering performance
```

---

### **6. Specific Issue: Server Response Time (TTFB)**

```markdown
My Time To First Byte is 1200ms (target: <600ms).

My setup:
- Backend: Next.js API routes
- Database: PostgreSQL on AWS RDS
- Hosting: Vercel
- No CDN configured

Please help me:
1. Set up CDN (Cloudflare or similar)
2. Implement edge caching
3. Optimize database queries (add indexes)
4. Add server-side caching with Redis
5. Use static generation where possible
```

---

## 🚀 **Pro Tips for AI Prompts**

### **1. Be Specific About Your Tech Stack**
```markdown
My tech stack:
- Framework: Next.js 14.2 (App Router)
- Styling: Tailwind CSS
- Hosting: Vercel
- Database: Supabase (PostgreSQL)
```

### **2. Include Relevant Code**
```markdown
Current implementation:
```javascript
// pages/index.tsx
import { Chart } from 'chart.js'; // This is loaded upfront
export default function Home() { ... }
```

### **3. Specify Constraints**
```markdown
Constraints:
- Must support IE11 (cannot use latest JS features)
- Cannot change hosting provider
- Need to maintain SEO-friendly URLs
```

### **4. Ask for Verification Steps**
```markdown
After implementing your suggestions, how can I:
1. Verify the improvements worked?
2. Measure the impact on Lighthouse score?
3. Test in production without breaking things?
```

---

## 🤖 **AI Assistant Recommendations**

| Task | Best AI Assistant | Why |
|------|-------------------|-----|
| **General Performance** | ChatGPT 4 / Claude Opus | Comprehensive analysis |
| **Code Implementation** | GitHub Copilot | In-editor suggestions |
| **Framework-Specific** | Cursor AI | Codebase-aware |
| **Quick Fixes** | Augment Code | Fast iterations |

---

## 📚 **Additional Resources**

- **VibeSafe Docs**: `docs/PERFORMANCE_SUGGESTIONS_API.md`
- **PageSpeed Setup**: `docs/PAGESPEED_API_SETUP.md`
- **Web.dev**: https://web.dev/vitals/
- **Lighthouse Scoring**: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/
