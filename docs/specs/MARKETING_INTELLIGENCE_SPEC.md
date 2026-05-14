# AI Marketing Intelligence Specification

**Feature:** P6-01: AI Marketing Intelligence  
**Phase:** 6 (Future - 2027+)  
**Status:** Planned  
**Priority:** P2 (Nice to Have)

---

## 🎯 Vision

**Transform VibeSafe from "fix problems" to "drive growth."**

After securing, ensuring compliance, and optimizing performance, help users **market their sites effectively** using AI-powered brand analysis and content generation.

---

## 💡 Problem Statement

### Current Reality
**AI coding tools (Cursor, v0, Bolt, Lovable) help developers ship fast, but leave them struggling with marketing:**
- ❌ Generic "My Awesome App" titles that don't convert
- ❌ Missing or poor Open Graph tags (ugly social shares)
- ❌ No idea how to write compelling ad copy
- ❌ Unclear value proposition
- ❌ 2-4 hours wasted on copywriting

### Opportunity
VibeSafe already:
- ✅ Scans the entire site (HTML, CSS, content)
- ✅ Uses Claude AI for security insights
- ✅ Understands tech stack and industry

**We can leverage this to generate optimized marketing assets automatically.**

---

## 🎯 Solution Overview

### What We Build
**AI-powered marketing asset generator that:**
1. Analyzes live website (brand, content, audience)
2. Generates conversion-optimized marketing materials
3. Provides copy-paste code and templates
4. Offers A/B test variations

### What Users Get
- **SEO meta tags** (title, description, keywords)
- **Social media tags** (Open Graph, Twitter Cards)
- **Ad copy** (Google Ads, Facebook/Instagram - 3+ variants)
- **Social templates** (Product Hunt, Twitter, LinkedIn)
- **Email subject lines** (welcome, re-engagement, announcements)
- **Value propositions** (one-liners, elevator pitches)

---

## 🏗️ Technical Architecture

### Module: P6-01: AI Marketing Intelligence

#### Input
```typescript
interface MarketingAnalysisInput {
  crawlResult: CrawlResult;      // HTML, CSS, headers
  scanData: ScanData;             // Existing scan results
  userContext?: {                 // Optional user input
    targetAudience?: string;      // "developers", "marketers"
    industry?: string;             // "SaaS", "e-commerce"
    uniqueSellingPoint?: string;  // What makes you different
  };
}
```

#### AI Analysis Process
1. **Extract Brand Elements**
   - Colors (from CSS, images)
   - Typography (font families)
   - Imagery style (screenshots, SVG analysis)
   - Design patterns (modern, minimal, playful)

2. **Analyze Content**
   - Homepage hero text (H1, H2)
   - About page content
   - Product/feature descriptions
   - Call-to-action buttons
   - Tone analysis (formal, casual, technical)

3. **Infer Business Context**
   - Industry/vertical (SaaS, blog, e-commerce)
   - Target audience (developers, consumers, B2B)
   - Value proposition (what problem solved)
   - Key features/benefits
   - Tech stack (already detected)

4. **Current SEO State**
   - Existing meta tags
   - Missing tags
   - Competitor positioning (inferred)

#### AI Prompt Structure
```typescript
const prompt = `You are a marketing copywriter analyzing a website to generate optimized marketing assets.

WEBSITE ANALYSIS:
URL: ${url}
Industry: ${detectedIndustry}
Tech Stack: ${techStack.join(', ')}
Target Audience: ${inferredAudience}

HOMEPAGE CONTENT:
${heroText}
${features}

CURRENT META TAGS:
Title: ${currentTitle || 'None'}
Description: ${currentDescription || 'None'}

BRAND ELEMENTS:
Colors: ${colors.join(', ')}
Typography: ${fonts.join(', ')}
Tone: ${detectedTone}

TASK:
Generate optimized marketing assets in JSON format:
{
  "metaTags": {
    "title": "50-60 char SEO-optimized title",
    "description": "150-160 char compelling description",
    "keywords": ["keyword1", "keyword2"]
  },
  "openGraph": {
    "title": "Social media optimized title",
    "description": "Benefit-focused social description"
  },
  "adCopy": {
    "google": [
      { "headline": "30 char max", "description": "90 char max", "variant": "feature-focused" },
      { "headline": "...", "description": "...", "variant": "pain-point" },
      { "headline": "...", "description": "...", "variant": "benefit-driven" }
    ],
    "facebook": [
      { "copy": "125 char engaging copy", "variant": "social-proof" },
      { "copy": "...", "variant": "problem-solution" }
    ]
  },
  "valueProposition": {
    "oneLiner": "One sentence value prop",
    "elevator": "30 second pitch",
    "tagline": "Catchy tagline"
  }
}

Guidelines:
- Be specific, not generic
- Use numbers/metrics when possible
- Focus on benefits, not just features
- Match the detected tone
- Optimize for click-through rate
`;
```

#### Output
```typescript
interface MarketingAssets {
  analysis: {
    brandColors: string[];
    typography: string[];
    tone: 'professional' | 'casual' | 'technical' | 'playful';
    industry: string;
    targetAudience: string;
    valueProposition: string;
  };
  
  metaTags: {
    title: string;
    description: string;
    keywords: string[];
  };
  
  openGraph: {
    title: string;
    description: string;
    type: string;
  };
  
  twitterCard: {
    card: string;
    title: string;
    description: string;
  };
  
  adCopy: {
    google: AdVariant[];
    facebook: AdVariant[];
  };
  
  socialTemplates: {
    productHunt: string;
    twitter: string;
    linkedin: string;
  };
  
  emailSubjects: {
    welcome: string[];
    reengagement: string[];
    announcement: string[];
  };
  
  valuePropositions: {
    oneLiner: string;
    elevator: string;
    tagline: string;
  };
}
```

---

## 🎨 User Experience

### UI Flow

**Option 1: New Tab in Report**

```
Report Navigation:
[ Security ] [ Compliance ] [ Performance ] [ A11y ] [ SEO ] [ 🎨 Marketing ] ← NEW
```

Click → Shows:
1. **Brand Analysis Summary**
   ```
   🎨 Brand Analysis

   Colors: #3B82F6 (primary), #10B981 (accent)
   Typography: Inter, system-ui
   Tone: Professional, Developer-focused
   Industry: SaaS / Project Management
   Target Audience: Remote teams, developers

   Value Proposition:
   "Visual project management for remote teams that actually enjoy using it"
   ```

2. **Generated Assets (Tabs)**
   - **Meta Tags** - Copy-paste HTML
   - **Ad Copy** - Google/Facebook variants
   - **Social Posts** - Templates with [placeholders]
   - **Emails** - Subject line ideas

3. **Copy-Paste Code Blocks**
   ```html
   <!-- SEO Meta Tags - Copy to <head> -->
   <title>TaskFlow - Visual Project Management for Remote Teams</title>
   <meta name="description" content="...">

   <!-- Open Graph Tags -->
   <meta property="og:title" content="...">
   ...

   [Copy All] button
   ```

**Option 2: Post-Scan Upsell**
```
✅ Scan Complete!

Security: A (92/100)
Compliance: Partial
Performance: B (84/100)

🎯 Want to optimize for growth?
   Generate marketing assets to improve conversions

   [ Generate Marketing Assets - $9 ] [ Included in Pro ]
```

**Option 3: Standalone Feature**
```
Dashboard → "Marketing Assets" button
→ Enter URL → Analyze → Get assets (no full scan needed)

Use case: Quick marketing copy without full security scan
```

---

## 💰 Monetization

### Pricing Strategy

**Recommended: Part of Pro Tier**
```
Free Tier:
- Security scan
- Basic SEO check
- ❌ No marketing assets

Pro Tier ($29/mo):
- Everything in Free
- Performance, A11y, SEO scanning
- Compliance checks
- ✅ AI Marketing Intelligence
- Unlimited asset generation
```

**Alternative: Add-On**
```
- $9 per analysis (one-time)
- $20 for 3 analyses (bulk discount)
- Agencies: $50/mo unlimited
```

### Cost Analysis
- **Claude API cost:** ~$0.02-0.05 per analysis
- **Margin:** 98%+ (if part of $29/mo tier)
- **Break-even:** 1 analysis per month at Pro tier

---

## 📊 Success Metrics

### User Metrics
- **Conversion rate:** % of users who generate marketing assets
- **Time saved:** Target 2-4 hours per user
- **CTR improvement:** Track before/after meta tag changes (user-reported)
- **NPS boost:** Survey users on marketing feature value

### Business Metrics
- **Free → Pro conversion lift:** Target +10-15%
- **Feature adoption:** % of Pro users using marketing intelligence
- **Retention:** Do users who use marketing feature retain better?
- **Referrals:** "VibeSafe wrote my ad copy!" shareable moment

---

## 🛣️ Implementation Roadmap

### Phase 6.1: MVP (3-4 weeks)
**Core deliverables:**
- ✅ Brand analysis (colors, fonts, tone)
- ✅ Meta tag generation (title, description, keywords)
- ✅ Open Graph tag generation
- ✅ Twitter Card generation
- ✅ Copy-paste UI with syntax highlighting

**Tech:**
- New module: `src/lib/scanner/modules/p6-01-marketing-intelligence.ts`
- AI integration: Extend existing `src/lib/llm/enrichment.ts`
- UI: New tab in report view

### Phase 6.2: Ad Copy (2-3 weeks)
- ✅ Google Ads copy generation (3 variants)
- ✅ Facebook/Instagram ad copy (2 variants)
- ✅ Variant explanations (why each works)
- ✅ A/B test suggestions

### Phase 6.3: Social & Email (2 weeks)
- ✅ Product Hunt launch template
- ✅ Twitter thread ideas
- ✅ LinkedIn post templates
- ✅ Email subject lines (3 categories)

### Phase 6.4: Advanced (Future)
- ✅ Landing page headline optimizer
- ✅ Competitor analysis (scrape similar sites)
- ✅ Visual brand guide export (PDF)
- ✅ Content calendar suggestions

**Total Estimate:** 8-12 weeks for full feature

---

## ⚠️ Risks & Mitigations

### Risk 1: AI Generates Generic/Bad Copy
**Mitigation:**
- Provide 3+ variants (user picks best)
- Allow inline editing before export
- Show as "starting point, not final copy"
- Gather user feedback, improve prompts

### Risk 2: Users Expect Full Copywriting Tool
**Mitigation:**
- Clear scope: "Marketing assets, not full content"
- Don't generate blog posts, full landing pages
- Position as "optimization assistant"

### Risk 3: Cost Overruns (Claude API)
**Mitigation:**
- Gate behind Pro tier (fixed monthly cost)
- Set rate limits (e.g., 10 analyses/month for Pro)
- Cache results for same URL (7 days)

### Risk 4: Low Adoption
**Mitigation:**
- Educate users: "After security, optimize growth"
- Show before/after examples in marketing
- Offer free trial (1 analysis) to hook users

---

## 🎯 Competitive Analysis

### Existing Solutions

**Copywriting Tools (Copy.ai, Jasper):**
- Generic templates, no site analysis
- $30-100/month pricing
- Not tailored to your actual site

**SEO Tools (Ahrefs, Semrush):**
- Check existing tags, don't generate new ones
- $99-999/month pricing
- Complex, enterprise-focused

**Security Scanners (Snyk, Burp):**
- No marketing features at all
- Only find problems, don't help growth

### VibeSafe's Unique Position
**Only tool that:**
1. ✅ Analyzes your live site (not generic)
2. ✅ Generates optimized marketing assets
3. ✅ Includes security + compliance + marketing
4. ✅ Tailored to your tech stack
5. ✅ Affordable for indie devs ($29/mo vs $100+)

---

## 📚 Example Output

### Sample: example.com Analysis

**Brand Analysis:**
```yaml
Colors: #3B82F6 (primary blue), #10B981 (accent green)
Typography: Inter (headings), system-ui (body)
Tone: Professional but approachable, developer-focused
Industry: SaaS - Project Management
Target Audience: Remote teams, developers, product managers
Current Messaging: "Stay organized, ship faster"
```

**Generated Meta Tags:**
```html
<title>TaskFlow - Visual Project Management for Remote Teams | Free Trial</title>
<meta name="description" content="TaskFlow helps remote teams stay organized with visual Kanban boards, time tracking, and Slack integration. Join 10,000+ teams shipping faster. Try free for 14 days.">
<meta name="keywords" content="project management, kanban, remote teams, task tracking, team collaboration">

<!-- Open Graph -->
<meta property="og:title" content="TaskFlow - Ship Projects 3x Faster">
<meta property="og:description" content="Visual project management built for remote teams. Kanban boards + time tracking + integrations. Free 14-day trial.">
<meta property="og:image" content="https://example.com/og-image.png">
<meta property="og:type" content="website">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Ship projects faster with TaskFlow">
<meta name="twitter:description" content="Visual boards, real-time collaboration, integrations. Try free for 14 days.">
```

**Google Ads Variants:**
```
Variant A (Feature-focused):
Headline: Visual Project Management for Teams
Description: Kanban boards, time tracking, Slack integration. 14-day free trial, no credit card.

Variant B (Pain-point):
Headline: Stop Losing Track of Team Tasks
Description: TaskFlow keeps remote teams organized. Used by 10,000+ teams. Try free today.

Variant C (Benefit-driven):
Headline: Ship Projects 3x Faster | TaskFlow
Description: Visual boards eliminate chaos. Real-time collaboration. Free for teams under 5.
```

**Value Propositions:**
```
One-liner:
"Visual project management for remote teams that actually enjoy using it."

Elevator Pitch:
"TaskFlow helps remote teams stay organized with visual Kanban boards, built-in
time tracking, and Slack integration. Unlike complex tools like Jira, TaskFlow
takes 5 minutes to set up and teams love using it. Over 10,000 teams ship
projects 3x faster with TaskFlow."

Tagline:
"From chaos to shipped—in minutes, not meetings."
```

---

## 🚀 Go-to-Market Strategy

### Launch Plan

**Phase 1: Beta (Internal Testing)**
- Soft launch to Pro users
- Gather feedback, iterate on prompts
- Refine UI based on usage

**Phase 2: Public Launch**
- Blog post: "Introducing AI Marketing Intelligence"
- Product Hunt launch (separate from main VibeSafe launch)
- Twitter campaign: "Built my site with Cursor, marketed it with VibeSafe"

**Phase 3: Growth**
- Case studies: Before/after CTR improvements
- Integration with Cursor/v0 communities
- Affiliate program for agencies

### Messaging

**Headline:**
"From Security to Growth—Automatically"

**Sub-headline:**
"VibeSafe doesn't just secure your site. We analyze your brand and generate optimized marketing assets that drive conversions."

**Social Proof:**
> "I built my SaaS with Cursor in a weekend. VibeSafe wrote my marketing copy in 90 seconds. Saved me $200 on copywriters."
> — Indie Hacker using VibeSafe

---

## ✅ Definition of Done

### MVP Success Criteria
- [ ] Can analyze any website and extract brand elements
- [ ] Generates SEO meta tags (title, description, keywords)
- [ ] Generates Open Graph and Twitter Card tags
- [ ] UI allows copy-paste with syntax highlighting
- [ ] Costs <$0.10 per analysis (Claude API)
- [ ] 90%+ of users find assets "useful or very useful"
- [ ] Conversion lift: +5% Free → Pro (measured over 30 days)

---

## 📖 Resources

### Reference Tools
- **Copy.ai** - Study their templates
- **Jasper** - Analyze prompt engineering
- **Ahrefs Meta Tag Generator** - Benchmark against
- **Product Hunt** - Study top launches for copywriting patterns

### AI Prompting
- Anthropic Prompt Engineering Guide
- OpenAI Best Practices for GPT-4
- Marketing Copy Frameworks (PAS, AIDA, BAB)

---

## 🎯 Next Steps

**To implement this feature:**

1. **Create P6-01 module structure**
   ```bash
   src/lib/scanner/modules/p6-01-marketing-intelligence.ts
   ```

2. **Extend LLM integration**
   ```bash
   src/lib/llm/marketing-prompts.ts
   ```

3. **Add UI tab**
   ```bash
   src/app/report/[id]/marketing-view.tsx
   ```

4. **Add to Pro tier feature list**
   ```bash
   Update pricing page, feature flags
   ```

5. **Beta test with 10-20 Pro users**
   - Gather feedback
   - Iterate on prompts
   - Measure CTR improvements

---

**Status:** Ready for implementation when Phase 5 (Compliance) is complete.

**Priority:** P2 (Nice to Have)
**Timeline:** 2027+ (Future Phase)
**Estimated Effort:** 8-12 weeks

---

**This feature positions VibeSafe as the only tool that takes you from "secure" to "successful."** 🚀

