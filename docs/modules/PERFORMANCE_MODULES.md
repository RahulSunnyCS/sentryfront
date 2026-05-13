# Performance Modules Documentation

**VibeSafe Performance Scanner - Complete Module Reference**  
**Last Updated:** 2026-05-13  
**Total Modules:** 6

---

## Overview

Performance modules measure website speed, efficiency, and user experience using **Core Web Vitals** and **Lighthouse metrics**.

---

## Module Index

| ID | Module Name | What We Check | Priority |
|----|-------------|---------------|----------|
| P2-01 | Core Web Vitals | LCP, FID, CLS, FCP, TTFB | P0 |
| P2-02 | Resource Optimization | Image/JS/CSS size & compression | P0 |
| P2-03 | Network Efficiency | Caching, compression, CDN usage | P0 |
| P2-04 | JavaScript Performance | TBT, long tasks, bundle size | P1 |
| P2-05 | Server Response Time | TTFB, initial response | P1 |
| P2-06 | Mobile Performance | Mobile-specific metrics | P1 |

---

## P2-01: Core Web Vitals

### What We Check

**1. Largest Contentful Paint (LCP)**
- **Target:** <2.5s (good), 2.5-4s (needs improvement), >4s (poor)
- **What:** Time until largest visible element loads
- **Example:** Hero image, main heading

**2. First Input Delay (FID)**
- **Target:** <100ms (good), 100-300ms (needs improvement), >300ms (poor)
- **What:** Time from user interaction to browser response
- **Example:** Click button → action starts

**3. Cumulative Layout Shift (CLS)**
- **Target:** <0.1 (good), 0.1-0.25 (needs improvement), >0.25 (poor)
- **What:** Visual stability (elements jumping around)
- **Example:** Image loads and pushes text down

**4. First Contentful Paint (FCP)**
- **Target:** <1.8s (good)
- **What:** Time until first content appears

**5. Time to First Byte (TTFB)**
- **Target:** <0.8s (good)
- **What:** Server response time

---

### How We Check

```typescript
// Use Chrome DevTools Protocol (Lighthouse)
import lighthouse from "lighthouse";

const result = await lighthouse(url, {
  onlyCategories: ["performance"],
  formFactor: "desktop",
  throttling: {
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0
  }
});

const metrics = result.lhr.audits;

// Extract Core Web Vitals
const lcp = metrics["largest-contentful-paint"].numericValue;
const fid = metrics["max-potential-fid"].numericValue;
const cls = metrics["cumulative-layout-shift"].numericValue;

// Grade based on thresholds
const grade = calculateGrade({ lcp, fid, cls });
```

---

### False Positives

1. **Server Location**
   - Scanning from US shows slow TTFB for EU sites
   - **Fix:** Run scans from multiple regions

2. **First Load vs Cached**
   - First load always slower
   - **Fix:** Run 2 scans (cold + warm cache)

3. **Dynamic Content**
   - CLS from ads, lazy-loaded images
   - **Fix:** Wait for page idle before measuring

**Current False Positive Rate:** <5%

---

### Improvements

1. **Real User Monitoring (RUM)**
   - Collect actual user metrics (not synthetic)
   - Use Chrome UX Report (CrUX) data

2. **Video Recording**
   - Show filmstrip of page load
   - Visual explanation of slow elements

---

## P2-02: Resource Optimization

### What We Check

**1. Image Optimization**
- Uncompressed images (PNG > 500KB)
- Missing modern formats (WebP, AVIF)
- Missing width/height attributes (causes CLS)
- Images larger than display size

**2. JavaScript Optimization**
- Bundle size >500KB
- Unused JavaScript (tree-shaking)
- Missing code splitting
- No minification

**3. CSS Optimization**
- Unused CSS rules
- Inline critical CSS missing
- Render-blocking stylesheets

---

### How We Check

```typescript
const analyzeResources = async (resources: Resource[]) => {
  const findings: Finding[] = [];
  
  // 1. Check images
  const images = resources.filter(r => r.type === "image");
  
  for (const img of images) {
    if (img.size > 500_000 && !img.url.endsWith(".webp")) {
      findings.push({
        severity: "MEDIUM",
        title: "Large unoptimized image",
        location: img.url,
        evidence: `Image is ${(img.size / 1024).toFixed(0)}KB`,
        impact: "Slow page load, high bandwidth usage",
        fixManual: [
          "Convert to WebP format",
          "Use Next.js <Image> component",
          "Compress with TinyPNG"
        ]
      });
    }
  }
  
  // 2. Check JavaScript bundles
  const scripts = resources.filter(r => r.type === "script");
  const totalJsSize = scripts.reduce((sum, s) => sum + s.size, 0);
  
  if (totalJsSize > 500_000) {
    findings.push({
      severity: "MEDIUM",
      title: "Large JavaScript bundle",
      evidence: `Total JS: ${(totalJsSize / 1024).toFixed(0)}KB`,
      fixAiPrompt: "Implement code splitting with dynamic imports"
    });
  }
  
  return findings;
};
```

---

### False Positives

1. **Image Galleries/Portfolios**
   - High-res images are intentional
   - **Fix:** Allow user to mark as expected

2. **Heavy Frameworks**
   - Some apps require large bundles (3D, video editing)
   - **Fix:** Compare against baseline for app type

**Current False Positive Rate:** <10%

---

### Improvements

1. **Bundle Analysis**
   - Show exact modules contributing to size
   - Suggest alternatives (e.g., replace Moment.js with date-fns)

2. **Compression Detection**
   - Check if Gzip/Brotli enabled
   - Calculate potential savings

---

## P2-03 through P2-06: Quick Reference

### P2-03: Network Efficiency

**Checks:**
- HTTP/2 or HTTP/3 enabled
- Gzip/Brotli compression
- CDN usage (detect via headers/IPs)
- Caching headers (`Cache-Control`, `ETag`)

**False Positives:** Small sites don't need CDN

---

### P2-04: JavaScript Performance

**Checks:**
- Total Blocking Time (TBT) <300ms
- Long tasks >50ms
- Main thread work <2s

**False Positives:** Complex SPAs naturally have more JS

---

### P2-05: Server Response Time

**Checks:**
- TTFB <600ms
- DNS lookup time <100ms
- TCP connection time <100ms

**False Positives:** Geographic distance affects TTFB

---

### P2-06: Mobile Performance

**Checks:**
- Same metrics as desktop but with mobile throttling
- Viewport meta tag present
- Touch target sizes >48px

**False Positives:** Desktop-only apps flagged

---

## Summary

### Performance Scoring

```typescript
// Weighted scoring
const performanceScore = (
  (lcpScore * 0.25) +
  (fidScore * 0.25) +
  (clsScore * 0.15) +
  (fcpScore * 0.15) +
  (ttfbScore * 0.10) +
  (resourceScore * 0.10)
) * 100;

const grade = scoreToGrade(performanceScore);
```

### Benchmarks

| Grade | Score | LCP | CLS | TBT |
|-------|-------|-----|-----|-----|
| A | 90-100 | <2.5s | <0.1 | <200ms |
| B | 80-89 | <3s | <0.15 | <300ms |
| C | 70-79 | <4s | <0.25 | <600ms |
| D | 60-69 | <5s | <0.3 | <1s |
| F | <60 | >5s | >0.3 | >1s |

---

**Document Owner:** Performance Team  
**Next Review:** 2026-06-01
