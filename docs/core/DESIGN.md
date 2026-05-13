# UI/UX Design Document

**VibeSafe - Design System & User Experience**  
**Version:** 2.0  
**Last Updated:** 2026-05-13  
**Status:** Active Development

---

## 1. Design Principles

### 1.1 Core Values

**1. Clarity Over Cleverness**
- Security is serious—avoid playful UI that undermines trust
- Clear labels, no jargon
- Explain technical findings in plain English

**2. Speed & Efficiency**
- Scans complete in <30 seconds
- Results load instantly
- Minimal clicks to key actions

**3. Trust & Professionalism**
- Enterprise-grade appearance
- Transparent about limitations
- No dark patterns or aggressive upsells

**4. Accessibility First**
- WCAG 2.2 Level AA compliant
- Keyboard navigable
- Screen reader friendly
- (We scan for a11y—we must exemplify it)

---

## 2. Color Palette

### 2.1 Primary Colors

```
Brand Primary (Blue):
  - Primary-900: #0A2463 (Dark blue, headings)
  - Primary-700: #1E3A8A (Links, buttons)
  - Primary-500: #3B82F6 (Default blue)
  - Primary-300: #93C5FD (Hover states)
  - Primary-100: #DBEAFE (Backgrounds)

Neutral (Gray):
  - Gray-900: #111827 (Body text)
  - Gray-700: #374151 (Secondary text)
  - Gray-500: #6B7280 (Muted text)
  - Gray-300: #D1D5DB (Borders)
  - Gray-100: #F3F4F6 (Backgrounds)
  - White: #FFFFFF
```

### 2.2 Semantic Colors

```
Severity Levels (Findings):
  - Critical: #DC2626 (Red-600)
  - High:     #EA580C (Orange-600)
  - Medium:   #F59E0B (Amber-500)
  - Low:      #10B981 (Green-500)
  - Info:     #3B82F6 (Blue-500)

Grades:
  - A+/A: #16A34A (Green-600) ✨
  - B:    #84CC16 (Lime-500)
  - C:    #F59E0B (Amber-500)
  - D:    #F97316 (Orange-500)
  - F:    #DC2626 (Red-600)

Status:
  - Success: #10B981 (Green-500)
  - Warning: #F59E0B (Amber-500)
  - Error:   #EF4444 (Red-500)
  - Info:    #3B82F6 (Blue-500)
```

---

## 3. Typography

### 3.1 Font Stack

```css
/* Headings */
--font-heading: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                Roboto, sans-serif;
                
/* Body text */
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             Roboto, sans-serif;
             
/* Code/monospace */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

**Rationale:**
- Inter: Excellent readability, professional, free
- System fonts as fallback: Fast loading
- JetBrains Mono: Great for code snippets, clear distinction

### 3.2 Type Scale

```css
--text-xs:   0.75rem;  /* 12px - Labels */
--text-sm:   0.875rem; /* 14px - Small text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg:   1.125rem; /* 18px - Large body */
--text-xl:   1.25rem;  /* 20px - H4 */
--text-2xl:  1.5rem;   /* 24px - H3 */
--text-3xl:  1.875rem; /* 30px - H2 */
--text-4xl:  2.25rem;  /* 36px - H1 */
--text-5xl:  3rem;     /* 48px - Hero */
```

---

## 4. Component Library

### 4.1 Buttons

**Primary Button:**
```jsx
<button className="bg-primary-600 hover:bg-primary-700 text-white 
                   px-4 py-2 rounded-lg font-medium 
                   focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Scan Now
</button>
```

**Secondary Button:**
```jsx
<button className="bg-gray-100 hover:bg-gray-200 text-gray-900 
                   px-4 py-2 rounded-lg font-medium">
  View Details
</button>
```

**Danger Button:**
```jsx
<button className="bg-red-600 hover:bg-red-700 text-white 
                   px-4 py-2 rounded-lg font-medium">
  Delete Scan
</button>
```

---

### 4.2 Cards

**Finding Card:**
```
┌──────────────────────────────────────────────┐
│ 🔴 CRITICAL                    [View Details]│
├──────────────────────────────────────────────┤
│ Missing Content-Security-Policy header       │
│                                               │
│ Your site is vulnerable to XSS attacks...    │
│                                               │
│ 📍 Location: HTTP Response Headers           │
│                                               │
│ [Copy Fix Prompt]  [Mark as False Positive] │
└──────────────────────────────────────────────┘
```

**Grade Badge:**
```
  ┌───────┐
  │   B   │  85/100
  └───────┘
  
  Colors: A (Green), B (Lime), C (Amber), D (Orange), F (Red)
```

---

### 4.3 Forms

**Input Field:**
```jsx
<div className="space-y-1">
  <label htmlFor="url" className="block text-sm font-medium text-gray-700">
    Website URL
  </label>
  <input
    id="url"
    type="url"
    placeholder="https://example.com"
    className="w-full px-3 py-2 border border-gray-300 rounded-lg
               focus:ring-2 focus:ring-primary-500 focus:border-transparent"
  />
  <p className="text-xs text-gray-500">Enter the URL you want to scan</p>
</div>
```

---

## 5. Key Pages & User Flows

### 5.1 Homepage (/)

**Hero Section:**
```
┌────────────────────────────────────────────────────┐
│           VibeSafe - Web Quality Scanner           │
│                                                     │
│  Scan your website for security, performance,      │
│  accessibility, and SEO issues in 10 seconds       │
│                                                     │
│  ┌─────────────────────────────────────────┐      │
│  │ https://                                 │ [Scan]│
│  └─────────────────────────────────────────┘      │
│                                                     │
│  ✅ 15 Security Checks  ✅ AI-Powered Insights     │
│  ✅ WCAG 2.2 Compliance  ✅ Core Web Vitals        │
└────────────────────────────────────────────────────┘
```

**Trust Indicators:**
- "Used by 10,000+ developers"
- Logos: GitHub, Vercel, Anthropic
- "No credit card required for free scans"

---

### 5.2 Scan Results (/report/:id)

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [Logo]  VibeSafe                  [Dashboard]   │
├──────────────────────────────────────────────────┤
│                                                   │
│  example.com                                      │
│  Scanned 3 minutes ago                            │
│                                                   │
│  ┌──────┐  Overall Grade                         │
│  │  B   │  85/100                                 │
│  └──────┘                                         │
│  ⚠️  12 issues found (2 HIGH, 5 MEDIUM, 5 LOW)   │
│                                                   │
│  [📥 Export PDF]  [🔄 Re-scan]  [📊 Compare]     │
│                                                   │
├──────────────────────────────────────────────────┤
│                                                   │
│  📊 Summary by Category                          │
│  ┌──────────┬──────┬──────────┐                 │
│  │ Security │  B   │ 2 issues │                 │
│  │ Perf     │  A   │ 0 issues │                 │
│  │ A11y     │  C   │ 5 issues │                 │
│  │ SEO      │  B   │ 5 issues │                 │
│  └──────────┴──────┴──────────┘                 │
│                                                   │
├──────────────────────────────────────────────────┤
│                                                   │
│  🔴 HIGH: Missing Content-Security-Policy        │
│  Your site is vulnerable to XSS attacks...       │
│  [View Details]                                   │
│                                                   │
│  🟠 MEDIUM: Large unoptimized images             │
│  Images are slowing down your page...            │
│  [View Details]                                   │
│                                                   │
│  ...                                              │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

### 5.3 Finding Detail Modal

**Expandable Details:**
```
┌──────────────────────────────────────────────┐
│  🔴 CRITICAL: Exposed AWS Access Key         │
│                                   [✖ Close]  │
├──────────────────────────────────────────────┤
│                                               │
│  📍 Location:                                 │
│  HTML → <script src="app.js">                │
│  Line 42: const KEY = "AKIA..."              │
│                                               │
│  🧠 AI Explanation:                           │
│  Your AWS access key is visible in your      │
│  JavaScript bundle. Attackers can use this   │
│  to access your S3 buckets, EC2 instances,   │
│  and rack up charges...                       │
│                                               │
│  💡 How to Fix:                               │
│  1. Move key to .env file                    │
│  2. Use server-side API calls                │
│  3. Rotate the exposed key immediately       │
│                                               │
│  🤖 AI Coding Tool Prompt:                    │
│  ┌─────────────────────────────────────────┐ │
│  │ Move the AWS access key from client-    │ │
│  │ side code to a server-side environment  │ │
│  │ variable, and create an API endpoint... │ │
│  └─────────────────────────────────────────┘ │
│  [📋 Copy Prompt]                             │
│                                               │
│  [Mark as False Positive]  [Dismiss]         │
└──────────────────────────────────────────────┘
```

---

## 6. Responsive Design

### 6.1 Breakpoints

```css
/* Mobile */
@media (min-width: 640px) { /* sm */ }

/* Tablet */
@media (min-width: 768px) { /* md */ }

/* Desktop */
@media (min-width: 1024px) { /* lg */ }

/* Large Desktop */
@media (min-width: 1280px) { /* xl */ }
```

### 6.2 Mobile Adaptations

**Homepage:**
- Stack hero content vertically
- Full-width input field
- Larger tap targets (48px minimum)

**Results Page:**
- Hide sidebar (accessible via hamburger menu)
- Cards stack vertically
- Collapsible finding details

---

## 7. Accessibility Guidelines

**Keyboard Navigation:**
- All interactive elements tabbable
- Clear focus indicators (2px ring)
- Skip links for main content

**Color Contrast:**
- All text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- Don't rely on color alone (use icons + text)

**Screen Readers:**
- Semantic HTML (`<main>`, `<nav>`, `<article>`)
- ARIA labels where needed
- Alt text for all images

---

## 8. Animation & Motion

**Principles:**
- Subtle, not distracting
- Respect `prefers-reduced-motion`
- Fast (< 300ms)

**Examples:**
```css
/* Button hover */
.btn:hover {
  transform: translateY(-1px);
  transition: transform 150ms ease;
}

/* Card appear */
.card {
  animation: fadeIn 200ms ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

**Document Owner:** Design Team  
**Next Review:** 2026-06-01
