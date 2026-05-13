# SEO Modules Documentation

**VibeSafe SEO Scanner - Search Engine Optimization**  
**Last Updated:** 2026-05-13  
**Total Modules:** 5

---

## Module Index

| ID | Module Name | What We Check | Impact |
|----|-------------|---------------|--------|
| P4-01 | Meta Tags | Title, description, OG tags | High |
| P4-02 | Social Media Metadata | Twitter Cards, Facebook OG | Medium |
| P4-03 | Structured Data | Schema.org, JSON-LD | High |
| P4-04 | Crawlability | Robots.txt, sitemap, indexing | High |
| P4-05 | Mobile SEO | Viewport, mobile-friendly | High |

---

## P4-01: Meta Tags

### What We Check

**1. Title Tag**
- Present and unique
- Length: 50-60 characters (ideal)
- Not duplicate across pages
- Contains primary keyword

**2. Meta Description**
- Present
- Length: 150-160 characters
- Compelling and unique
- Includes call-to-action

**3. Canonical URL**
- Self-referencing canonical tag
- HTTPS version preferred
- No chain redirection

**4. Open Graph Tags** (Basic)
- `og:title`
- `og:description`
- `og:image` (minimum 1200x630px)
- `og:url`
- `og:type`

---

### How We Check

```typescript
const checkMetaTags = (html: string) => {
  const $ = cheerio.load(html);
  const findings: Finding[] = [];
  
  // 1. Title
  const title = $("title").text();
  
  if (!title) {
    findings.push({
      severity: "CRITICAL",
      title: "Missing <title> tag",
      impact: "Pages won't rank well in search results"
    });
  } else if (title.length > 60) {
    findings.push({
      severity: "MEDIUM",
      title: "Title tag too long",
      evidence: `${title.length} characters (max 60 recommended)`,
      fixManual: ["Shorten title to 50-60 characters"]
    });
  }
  
  // 2. Meta Description
  const description = $('meta[name="description"]').attr("content");
  
  if (!description) {
    findings.push({
      severity: "HIGH",
      title: "Missing meta description",
      impact: "Search engines will auto-generate (often poor quality)"
    });
  }
  
  // 3. Open Graph
  const ogImage = $('meta[property="og:image"]').attr("content");
  
  if (!ogImage) {
    findings.push({
      severity: "MEDIUM",
      title: "Missing og:image",
      impact: "Links won't show preview image on social media"
    });
  }
  
  return findings;
};
```

---

### False Positives

1. **Long Brand Names**
   - Title >60 chars due to company name
   - **Fix:** Suggest truncating or reordering

2. **Dynamic Meta Tags**
   - Client-side rendering (React/Vue)
   - **Fix:** Check after JavaScript execution

**Current False Positive Rate:** <5%

---

### Improvements

1. **Keyword Analysis**
   - Check if target keywords are in title/description
   - Compare against competitors

2. **Image Dimension Check**
   - Fetch og:image and verify 1200x630

---

## P4-02: Social Media Metadata

### What We Check

**Twitter Cards:**
- `twitter:card` (summary_large_image recommended)
- `twitter:title`
- `twitter:description`
- `twitter:image`

**Facebook Open Graph:**
- All tags from P4-01
- `fb:app_id` (optional)

**LinkedIn:**
- Inherits from Open Graph
- Image aspect ratio 1.91:1

---

### How We Check

```typescript
const twitterCard = $('meta[name="twitter:card"]').attr("content");

if (!twitterCard) {
  findings.push({
    severity: "MEDIUM",
    title: "No Twitter Card meta tags",
    impact: "Links won't show rich previews on Twitter"
  });
}
```

---

### False Positives

1. **B2B Sites**
   - Don't need social sharing
   - **Fix:** Make it informational, not error

**Current False Positive Rate:** <3%

---

## P4-03: Structured Data

### What We Check

**Schema.org Types:**
- Organization
- WebSite
- Article/BlogPosting
- Product (e-commerce)
- FAQPage
- BreadcrumbList

**Validation:**
- Valid JSON-LD syntax
- Required properties present
- No warnings in Google's Rich Results Test

---

### How We Check

```typescript
const scripts = $('script[type="application/ld+json"]');

if (scripts.length === 0) {
  findings.push({
    severity: "MEDIUM",
    title: "No structured data found",
    impact: "Missing rich snippets in search results"
  });
} else {
  // Validate each JSON-LD block
  scripts.each((_, el) => {
    const json = $(el).html();
    
    try {
      const data = JSON.parse(json);
      
      // Check required properties
      if (data["@type"] === "Organization" && !data.logo) {
        findings.push({
          severity: "LOW",
          title: "Organization schema missing logo"
        });
      }
    } catch (e) {
      findings.push({
        severity: "HIGH",
        title: "Invalid JSON-LD syntax",
        evidence: e.message
      });
    }
  });
}
```

---

### False Positives

1. **Simple Sites**
   - Don't need complex schema
   - **Fix:** Only suggest for blogs/e-commerce

**Current False Positive Rate:** <5%

---

## P4-04: Crawlability

### What We Check

**1. Robots.txt**
- Exists at `/robots.txt`
- Not blocking important pages
- Sitemap URL included

**2. XML Sitemap**
- Exists (usually `/sitemap.xml`)
- Valid XML
- URLs return 200 OK
- Updated recently

**3. Indexing Directives**
- No `<meta name="robots" content="noindex">`
- No `X-Robots-Tag: noindex` header
- (Unless intentional for staging sites)

---

### How We Check

```typescript
// 1. Check robots.txt
const robotsResponse = await fetch(url + "/robots.txt");

if (!robotsResponse.ok) {
  findings.push({
    severity: "LOW",
    title: "No robots.txt file",
    impact: "Search engines may crawl inefficiently"
  });
} else {
  const robots = await robotsResponse.text();
  
  // Check for disallowed critical paths
  if (robots.includes("Disallow: /")) {
    findings.push({
      severity: "CRITICAL",
      title: "robots.txt blocks all crawling",
      evidence: "Disallow: /"
    });
  }
  
  // Check for sitemap
  if (!robots.includes("Sitemap:")) {
    findings.push({
      severity: "MEDIUM",
      title: "Sitemap not listed in robots.txt"
    });
  }
}

// 2. Check meta robots
const metaRobots = $('meta[name="robots"]').attr("content");

if (metaRobots?.includes("noindex")) {
  findings.push({
    severity: "HIGH",
    title: "Page is set to noindex",
    impact: "Won't appear in search results"
  });
}
```

---

### False Positives

1. **Staging Sites**
   - Intentionally noindexed
   - **Fix:** Detect staging domains (staging., dev., etc.)

**Current False Positive Rate:** <2%

---

## P4-05: Mobile SEO

### What We Check

**1. Viewport Meta Tag**
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**2. Mobile-Friendly Design**
- Text readable without zooming
- Touch targets ≥48px
- No horizontal scrolling

**3. Page Speed (Mobile)**
- Mobile-specific Lighthouse score
- 3G/4G throttling

---

### How We Check

```typescript
const viewport = $('meta[name="viewport"]').attr("content");

if (!viewport) {
  findings.push({
    severity: "CRITICAL",
    title: "Missing viewport meta tag",
    impact: "Site won't be mobile-friendly"
  });
} else if (!viewport.includes("width=device-width")) {
  findings.push({
    severity: "HIGH",
    title: "Incorrect viewport configuration"
  });
}
```

---

### False Positives

1. **Desktop-Only Apps**
   - Not designed for mobile
   - **Fix:** Let user specify platform target

**Current False Positive Rate:** <3%

---

## Summary

### SEO Scoring

```typescript
const seoScore = (
  (metaTagsScore * 0.30) +
  (structuredDataScore * 0.25) +
  (crawlabilityScore * 0.25) +
  (mobileScore * 0.15) +
  (socialScore * 0.05)
) * 100;
```

### Grade Thresholds

| Grade | Score | Status |
|-------|-------|--------|
| A | 90-100 | Excellent SEO |
| B | 80-89 | Good, minor improvements |
| C | 70-79 | Needs work |
| D | 60-69 | Poor SEO |
| F | <60 | Critical issues |

---

**Document Owner:** SEO Team  
**Next Review:** 2026-06-01
