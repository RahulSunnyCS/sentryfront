# PageSpeed Insights Audits - Detailed Analysis

## Overview

The PageSpeed Insights API returns **47 different audits** with rich, page-specific data. We can use this instead of hardcoded strings to provide **actual, actionable insights**.

---

## ✅ **Feasibility: VERY HIGH**

**Advantages:**
1. ✅ **Real data** instead of generic advice
2. ✅ **Specific file URLs** that need optimization
3. ✅ **Exact savings** (bytes, milliseconds)
4. ✅ **Chrome DevTools links** for detailed investigation
5. ✅ **Up-to-date descriptions** from Google (maintained by Lighthouse team)
6. ✅ **Display values** (human-readable summaries)

**Implementation Effort:** Medium (2-4 hours)

---

## 📊 **What We Currently Store**

Currently in `src/lib/scanner/lighthouse.ts`:

```typescript
opportunities: [{
  id: 'unused-javascript',
  title: audit.title,           // ✅ Already capturing!
  description: audit.description, // ✅ Already capturing!
  wastedBytes: details?.overallSavingsBytes,
  wastedMs: details?.overallSavingsMs,
}]
```

**What we're MISSING:**
- ❌ Specific file URLs (e.g., which JS files to optimize)
- ❌ Per-file breakdown
- ❌ Display values (e.g., "Est savings of 547 KiB")
- ❌ Chrome DevTools screenshot data
- ❌ Specific recommendations per file

---

## 🎯 **Example: Unused JavaScript Audit**

### **Current (Generic)**
```
Title: "Reduce unused JavaScript"
Evidence: "547 KB could be saved"
AI Prompt: "I have 547 KB of unused JavaScript. Implement code splitting..."
```

### **With Real Audit Data (Specific)**
```
Title: "Reduce unused JavaScript"
Evidence: "547 KiB total savings across 3 files"

Specific Files:
  1. recaptcha__en.js
     - URL: https://www.gstatic.com/recaptcha/releases/.../recaptcha__en.js
     - Wasted: 202 KiB (54% unused)
     - Total size: 372 KiB
     
  2. main.bundle.js
     - URL: https://yoursite.com/static/js/main.bundle.js
     - Wasted: 280 KiB (68% unused)
     - Total size: 412 KiB
     
  3. vendor.bundle.js
     - URL: https://yoursite.com/static/js/vendor.bundle.js
     - Wasted: 65 KiB (22% unused)
     - Total size: 295 KiB

AI Prompt: 
"I have unused JavaScript in these specific files:
1. recaptcha__en.js (54% unused, 202 KiB wasted) - Third-party script
2. main.bundle.js (68% unused, 280 KiB wasted) - My code
3. vendor.bundle.js (22% unused, 65 KiB wasted) - Dependencies

Help me:
- Defer loading recaptcha until user interaction
- Implement code splitting for main.bundle.js
- Remove unused dependencies from vendor.bundle.js"
```

**Much more actionable!** 🎯

---

## 📋 **Available Audit Types**

Here are the most valuable audits with detailed data:

### **Performance Opportunities** (with file-level details)

| Audit ID | What It Shows | Details Available |
|----------|---------------|-------------------|
| `unused-javascript` | Unused JS per file | URL, wastedBytes, wastedPercent |
| `unused-css-rules` | Unused CSS per file | URL, wastedBytes, wastedPercent |
| `modern-image-formats` | Images to convert | URL, wastedBytes, format suggestions |
| `uses-optimized-images` | Unoptimized images | URL, wastedBytes, dimensions |
| `offscreen-images` | Images to lazy-load | URL, wastedBytes, wastedMs |
| `render-blocking-resources` | Blocking CSS/JS | URL, wastedMs, transfer size |
| `unminified-css` | Unminified CSS files | URL, wastedBytes, wastedPercent |
| `unminified-javascript` | Unminified JS files | URL, wastedBytes, wastedPercent |
| `uses-text-compression` | Files without gzip/brotli | URL, wastedBytes, transfer size |
| `uses-responsive-images` | Oversized images | URL, wastedBytes, actual vs. needed |
| `efficient-animated-content` | Large GIFs to convert | URL, wastedBytes (recommend WebM/MP4) |
| `duplicated-javascript` | Duplicate JS bundles | URL, wastedBytes |
| `legacy-javascript` | Old polyfills | URL, wastedBytes (recommend modern JS) |

### **Diagnostic Audits** (context & analysis)

| Audit ID | What It Shows |
|----------|---------------|
| `main-thread-tasks` | Long tasks blocking main thread (>50ms) |
| `third-party-summary` | All third-party scripts with impact |
| `bootup-time` | JavaScript execution time per file |
| `critical-request-chains` | Network request dependencies |
| `dom-size` | DOM tree size (elements, depth, children) |
| `font-display` | Font loading issues |
| `network-requests` | All network requests (timing, size) |

---

## 🎯 **Recommended Implementation**

### **Phase 1: Store Full Audit Data** ✅ Easiest
Store the complete audit response in the database for later use.

**Changes needed:**
1. Update `lighthouse.ts` to store full audit details
2. Update Prisma schema to add `performanceAudits` JSON field
3. Parse details in UI when generating suggestions

**Pros:**
- ✅ Minimal backend changes
- ✅ Full flexibility in UI
- ✅ Can iterate on UI without re-scanning

**Cons:**
- ⚠️ Larger database storage (JSON field)

### **Phase 2: Enhanced Suggestions with File-Level Detail** 🎯 Recommended
Generate richer AI prompts using actual file URLs and savings.

**Changes needed:**
1. Update `performance-suggestions.ts` to parse audit details
2. Generate file-specific AI prompts
3. Update UI to show file-level breakdown

**Example output:**
```typescript
{
  title: "Reduce unused JavaScript",
  affectedFiles: [
    {
      url: "https://site.com/main.bundle.js",
      wastedBytes: 280000,
      wastedPercent: 68,
      totalBytes: 412000
    }
  ],
  aiPrompt: "I have unused JavaScript in main.bundle.js (68% unused, 280 KiB wasted). Help me implement code splitting..."
}
```

### **Phase 3: Interactive File Explorer** 🚀 Advanced
Build a UI component that shows:
- Expandable list of files
- Click to see Chrome DevTools link
- Visual chart of wasted vs. used bytes

---

## 💡 **Quick Win: Immediate Implementation**

Let me show you how to implement **Phase 1** right now (15-30 minutes):

1. ✅ **Update `lighthouse.ts`** to store opportunities with full details
2. ✅ **Update suggestions generator** to use real file data
3. ✅ **Update UI** to show file-level details

**Result**: AI prompts like:
```
"My site has these specific performance issues:

1. main.bundle.js (68% unused, 280 KiB wasted)
   https://yoursite.com/static/js/main.bundle.js
   
2. recaptcha__en.js (54% unused, 202 KiB wasted)  
   https://www.gstatic.com/recaptcha/releases/.../recaptcha__en.js

Help me fix these by implementing code splitting and lazy loading."
```

---

## 📊 **Data Structure Example**

```json
{
  "id": "unused-javascript",
  "title": "Reduce unused JavaScript",
  "description": "Reduce unused JavaScript and defer loading scripts...",
  "score": 0.5,
  "displayValue": "Est savings of 547 KiB",
  "numericValue": 1200,
  "details": {
    "type": "opportunity",
    "headings": [...],
    "items": [
      {
        "url": "https://site.com/main.bundle.js",
        "wastedBytes": 280000,
        "wastedPercent": 68,
        "totalBytes": 412000
      }
    ],
    "overallSavingsBytes": 547000,
    "overallSavingsMs": 1200
  }
}
```

---

## ✅ **Recommendation**

**Implement Phase 1 + 2 NOW** (2-4 hours total):
1. ✅ Store full audit details in opportunities
2. ✅ Generate file-specific AI prompts
3. ✅ Show file breakdown in UI (collapsible list)

**Benefits:**
- 🎯 **10x more actionable** suggestions
- 🎯 **Specific file URLs** users can investigate
- 🎯 **Better AI prompts** that mention exact files
- 🎯 **Professional look** - shows you did deep analysis

**Effort**: Medium (but high ROI!)

---

Would you like me to implement this? I can do it right now! 🚀
