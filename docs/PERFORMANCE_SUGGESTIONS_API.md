# Performance Suggestions API

## Overview

After running a performance scan, VibeSafe can generate **AI-ready improvement suggestions** with prioritized action plans, effort estimates, and ready-to-use prompts for AI coding assistants.

---

## Endpoint

```
GET /api/v1/scans/:id/performance-suggestions
```

### Parameters
- `id` (required): Scan ID

### Response

```typescript
{
  scanId: string;
  targetUrl: string;
  performanceGrade: string; // A-F
  performanceScore: number; // 0-100
  summary: string; // Overall assessment
  
  quickWins: ImprovementSuggestion[]; // High impact, <1 hour effort
  majorImprovements: ImprovementSuggestion[]; // High impact, >1 hour effort
  optimizations: ImprovementSuggestion[]; // Medium/low impact
  
  aiPromptBundle: string; // Single comprehensive prompt for AI assistants
  
  meta: {
    totalSuggestions: number;
    quickWinsCount: number;
    majorImprovementsCount: number;
    optimizationsCount: number;
  };
}
```

### ImprovementSuggestion

```typescript
{
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string; // e.g., "Images", "JavaScript", "Core Web Vitals"
  title: string; // Short description
  description: string; // Detailed explanation
  aiPrompt: string; // Ready-to-use prompt for AI assistants
  estimatedImpact: string; // e.g., "Improve LCP by 1-2s"
  estimatedEffort: 'Quick Win (<1 hour)' | 'Medium (1-4 hours)' | 'Large (1-2 days)';
  relatedFindings: string[]; // Titles of related findings
}
```

---

## Usage Examples

### 1. **Get Suggestions for a Scan**

```bash
curl -s http://localhost:3001/api/v1/scans/cmp01234/performance-suggestions | jq '.'
```

### 2. **Extract AI Prompt Bundle**

```bash
curl -s http://localhost:3001/api/v1/scans/cmp01234/performance-suggestions \
  | jq -r '.aiPromptBundle'
```

**Output** (ready to paste into ChatGPT/Claude/Cursor):

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
```

### 3. **Get Only Quick Wins**

```bash
curl -s http://localhost:3001/api/v1/scans/cmp01234/performance-suggestions \
  | jq '.quickWins[]'
```

### 4. **Get High-Priority Improvements**

```bash
curl -s http://localhost:3001/api/v1/scans/cmp01234/performance-suggestions \
  | jq '[.quickWins[], .majorImprovements[]] | map(select(.priority == "HIGH"))'
```

---

## Use Cases

### **1. AI Coding Assistant Integration**

Copy the `aiPromptBundle` and paste into:
- ✅ ChatGPT
- ✅ Claude
- ✅ GitHub Copilot Chat
- ✅ Cursor AI
- ✅ Augment Code

The AI will provide specific code examples and implementation guidance.

### **2. Automated Performance Improvement Workflow**

```javascript
// Example: Slack bot that posts performance suggestions
const response = await fetch(`/api/v1/scans/${scanId}/performance-suggestions`);
const suggestions = await response.json();

if (suggestions.quickWins.length > 0) {
  await slack.postMessage({
    channel: '#performance',
    text: `🚀 Found ${suggestions.quickWinsCount} quick wins for ${suggestions.targetUrl}!\n\n${
      suggestions.quickWins.map(s => `• ${s.title}: ${s.estimatedImpact}`).join('\n')
    }`
  });
}
```

### **3. CI/CD Performance Gates**

```javascript
// Example: Fail build if critical performance issues exist
const suggestions = await getPerformanceSuggestions(scanId);
const criticalIssues = [...suggestions.quickWins, ...suggestions.majorImprovements]
  .filter(s => s.priority === 'CRITICAL');

if (criticalIssues.length > 0) {
  console.error(`❌ ${criticalIssues.length} critical performance issues found!`);
  process.exit(1);
}
```

---

## Suggestion Categories

The API analyzes performance data and generates suggestions in these categories:

| Category | What It Covers |
|----------|----------------|
| **Images** | WebP/AVIF conversion, compression, lazy loading |
| **JavaScript** | Code splitting, tree-shaking, unused code removal |
| **Server** | Compression, caching, CDN, TTFB optimization |
| **Core Web Vitals** | LCP, CLS, TBT fixes specific to thresholds |
| **JavaScript Performance** | Long tasks, main thread blocking, web workers |

---

## Priority Levels

- **CRITICAL**: Severe impact on UX and SEO (e.g., LCP > 4s)
- **HIGH**: Significant impact, should be addressed soon
- **MEDIUM**: Moderate impact, nice to have
- **LOW**: Minor optimization, polish

---

## Error Responses

### Scan Not Found
```json
{
  "error": "Scan not found."
}
```

### Scan Not Complete
```json
{
  "error": "Scan is not yet complete."
}
```

### No Performance Data
```json
{
  "error": "No performance data available for this scan.",
  "hint": "Performance scanning may be disabled or may have failed. Check scan logs."
}
```

---

## Future Enhancements

- [ ] **Visual comparison**: Before/after screenshots for suggested changes
- [ ] **Cost estimation**: Estimated development time in hours/days
- [ ] **ROI calculation**: Expected improvement in Lighthouse score
- [ ] **Code snippets**: Actual code examples for each suggestion
- [ ] **Tracking**: Mark suggestions as "implemented" and re-scan to verify
