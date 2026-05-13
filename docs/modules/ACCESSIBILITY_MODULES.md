# Accessibility Modules Documentation

**VibeSafe Accessibility Scanner - WCAG 2.2 Compliance**  
**Last Updated:** 2026-05-13  
**Total Modules:** 5

---

## Overview

Accessibility modules check compliance with **WCAG 2.2 Level AA** standards to ensure websites are usable by people with disabilities.

---

## Module Index

| ID | Module Name | WCAG Criteria | Priority |
|----|-------------|---------------|----------|
| P3-01 | Color Contrast | 1.4.3, 1.4.6 | P0 |
| P3-02 | Keyboard Navigation | 2.1.1, 2.1.2 | P0 |
| P3-03 | Screen Reader Support | 1.1.1, 4.1.2 | P0 |
| P3-04 | Semantic HTML | 1.3.1 | P1 |
| P3-05 | Forms & Interactive Elements | 3.3.1, 3.3.2 | P1 |

---

## P3-01: Color Contrast

### What We Check

**Text Contrast Ratios (WCAG 2.2):**

| Text Size | Level AA | Level AAA |
|-----------|----------|-----------|
| Normal text (<18pt) | 4.5:1 | 7:1 |
| Large text (≥18pt or ≥14pt bold) | 3:1 | 4.5:1 |
| UI Components | 3:1 | - |

**Common Issues:**
- Gray text on light background
- White text on pastel colors
- Link colors too similar to body text

---

### How We Check

```typescript
const checkContrast = async (url: string) => {
  const page = await browser.newPage();
  await page.goto(url);
  
  // Inject contrast checker
  const issues = await page.evaluate(() => {
    const findings: any[] = [];
    
    const elements = document.querySelectorAll("*");
    
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bgColor = style.backgroundColor;
      
      if (!color || !bgColor) continue;
      
      const ratio = calculateContrastRatio(color, bgColor);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = style.fontWeight;
      
      const threshold = (fontSize >= 18 || 
        (fontSize >= 14 && fontWeight >= 700)) ? 3 : 4.5;
      
      if (ratio < threshold) {
        findings.push({
          element: el.tagName,
          text: el.textContent.substring(0, 50),
          ratio: ratio.toFixed(2),
          required: threshold,
          foreground: color,
          background: bgColor
        });
      }
    }
    
    return findings;
  });
  
  return issues;
};
```

---

### False Positives

1. **Invisible Elements** (display: none)
   - **Fix:** Skip hidden elements

2. **Background Images**
   - Can't determine actual contrast
   - **Fix:** Manual review required

3. **Gradients/Overlays**
   - Complex to calculate
   - **Fix:** Sample multiple points

**Current False Positive Rate:** ~10%

---

### Improvements

1. **Smart Background Detection**
   - Traverse DOM tree to find actual background color
   - Handle semi-transparent overlays

2. **Image Text Analysis**
   - OCR + contrast check for text in images

---

## P3-02: Keyboard Navigation

### What We Check

- **Tab order** logical and sequential
- **Focus indicators** visible (outline, ring)
- **Skip links** present ("Skip to main content")
- **No keyboard traps** (can escape modals, menus)
- **All interactive elements** reachable via keyboard

---

### How We Check

```typescript
const checkKeyboardNav = async (page: Page) => {
  const findings: Finding[] = [];
  
  // 1. Check focus indicators
  const elementsWithoutFocus = await page.evaluate(() => {
    const interactive = document.querySelectorAll(
      "a, button, input, select, textarea, [tabindex]"
    );
    
    const issues: string[] = [];
    
    for (const el of interactive) {
      const style = window.getComputedStyle(el, ":focus");
      
      if (style.outline === "none" && style.boxShadow === "none") {
        issues.push(el.tagName + (el.id ? `#${el.id}` : ""));
      }
    }
    
    return issues;
  });
  
  if (elementsWithoutFocus.length > 0) {
    findings.push({
      severity: "HIGH",
      title: "Missing focus indicators",
      evidence: `${elementsWithoutFocus.length} elements have no visible focus`,
      impact: "Keyboard users can't see where they are"
    });
  }
  
  // 2. Check skip links
  const hasSkipLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"));
    return links.some(a => 
      a.textContent?.toLowerCase().includes("skip to main") ||
      a.textContent?.toLowerCase().includes("skip navigation")
    );
  });
  
  if (!hasSkipLink) {
    findings.push({
      severity: "MEDIUM",
      title: "No skip link found",
      impact: "Keyboard users must tab through all navigation"
    });
  }
  
  return findings;
};
```

---

### False Positives

1. **Custom Focus Styles**
   - Uses box-shadow instead of outline
   - **Fix:** Check for any visual change on :focus

2. **Single-Page Apps**
   - Skip links not always needed
   - **Fix:** Only flag if navigation >5 items

**Current False Positive Rate:** ~5%

---

## P3-03: Screen Reader Support

### What We Check

**1. Alternative Text**
- All `<img>` have `alt` attribute
- Decorative images: `alt=""`
- Informative images: meaningful `alt`

**2. ARIA Labels**
- Buttons have accessible names
- Icons have `aria-label`
- Form inputs have `<label>` or `aria-labelledby`

**3. Landmarks**
- `<header>`, `<nav>`, `<main>`, `<footer>` present
- Or equivalent ARIA roles

---

### How We Check

```typescript
// Check images
const images = document.querySelectorAll("img");

for (const img of images) {
  if (!img.hasAttribute("alt")) {
    findings.push({
      severity: "HIGH",
      title: "Image missing alt text",
      location: img.src,
      fixManual: ["Add alt attribute describing the image"]
    });
  }
}

// Check buttons
const buttons = document.querySelectorAll("button");

for (const btn of buttons) {
  const accessibleName = 
    btn.textContent ||
    btn.getAttribute("aria-label") ||
    btn.getAttribute("title");
  
  if (!accessibleName?.trim()) {
    findings.push({
      severity: "HIGH",
      title: "Button has no accessible name",
      impact: "Screen readers announce 'button' with no context"
    });
  }
}
```

---

### False Positives

1. **Icon Buttons with SVG**
   - SVG has title/desc but not detected
   - **Fix:** Check inside SVG for <title>

2. **ARIA-Hidden Elements**
   - Decorative elements correctly hidden
   - **Fix:** Skip aria-hidden="true" elements

**Current False Positive Rate:** ~8%

---

## P3-04 & P3-05: Quick Reference

### P3-04: Semantic HTML

**Checks:**
- Heading hierarchy (h1 → h2 → h3, no skips)
- Proper use of semantic tags (`<article>`, `<section>`, `<aside>`)
- No empty headings
- Lists use `<ul>/<ol>` not divs

**False Positives:** Creative layouts that don't follow strict hierarchy

---

### P3-05: Forms & Interactive Elements

**Checks:**
- All inputs have labels
- Required fields marked (HTML5 `required` or ARIA)
- Error messages associated with inputs
- Sufficient time for forms (no auto-timeout)

**False Positives:** Placeholder text mistaken for labels

---

## Summary

### Accessibility Scoring

```typescript
const a11yScore = (
  (contrastScore * 0.30) +
  (keyboardScore * 0.25) +
  (screenReaderScore * 0.25) +
  (semanticScore * 0.10) +
  (formsScore * 0.10)
) * 100;
```

### Compliance Levels

| Grade | Score | Compliance Level |
|-------|-------|------------------|
| A | 90-100 | WCAG 2.2 AAA |
| B | 80-89 | WCAG 2.2 AA |
| C | 70-79 | WCAG 2.1 AA |
| D | 60-69 | WCAG 2.0 AA |
| F | <60 | Non-compliant |

---

**Document Owner:** Accessibility Team  
**Next Review:** 2026-06-01
