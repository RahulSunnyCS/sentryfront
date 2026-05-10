# Performance Suggestions Demo

## 🎯 What This Demo Shows

This demo showcases VibeSafe's **file-specific performance suggestions** feature, which transforms generic performance advice into actionable, file-level insights.

## 🚀 Access the Demo

**Local Development:**
```bash
npm run dev
```

Then visit: **http://localhost:3001/demo/performance**

## 📊 What You'll See

### 1. Before/After Comparison

**Before (Generic):**
```
"You have unused JavaScript. Consider code splitting."
```

**After (File-Specific):**
```
I have unused JavaScript (total: 547 KiB) in these files:

1. recaptcha/api.js (202 KiB wasted, 84% unused)
   URL: https://www.google.com/recaptcha/...
2. main.chunk.js (142 KiB wasted, 77% unused)
   URL: https://example.com/static/js/...
3. lodash.min.js (67 KiB wasted, 96% unused)
   URL: https://cdn.jsdelivr.net/...

Help me:
1. Implement code splitting
2. Remove unused dependencies
3. Use dynamic imports
4. Enable tree-shaking
```

### 2. Performance Overview

- **Grade Visualization**: D grade with 42/100 score
- **Core Web Vitals**: LCP, FCP, CLS, TBT, TTFB with color-coded status
- **Performance Metrics**: All metrics are realistic and demonstrate poor performance

### 3. AI-Powered Suggestions

The demo includes:

#### Quick Wins (High impact, <1 hour)
- None in this demo (performance is quite poor)

#### Major Improvements (High impact, medium effort)
- **Optimize 4 images** - 387 KiB savings with specific file URLs
- **Remove unused JavaScript from 5 files** - 547 KiB savings with per-file breakdown
- **Fix LCP** (4.2s → target <2.5s)

### 4. Expandable AI Prompts

Click on any suggestion card to:
- See estimated impact and effort
- View the complete AI prompt with file-specific details
- Copy the prompt directly to use with ChatGPT/Claude

### 5. Complete AI Prompt Bundle

Click "Show Complete AI Prompt" to see a comprehensive prompt that includes:
- Current performance metrics
- All issues prioritized by severity
- Specific file details for each issue
- Ready to paste into any AI assistant

## 💡 Key Features Demonstrated

1. ✅ **Real File URLs** - Shows actual file paths that need optimization
2. ✅ **Exact Savings** - Displays precise KB/ms that can be saved per file
3. ✅ **Percentage Unused** - Shows how much of each file is wasted (e.g., 84% unused)
4. ✅ **Prioritization** - Sorts by impact (bytes + ms)
5. ✅ **Copy-to-Clipboard** - One-click copy for AI prompts
6. ✅ **Expandable Details** - Click to see more information

## 🔍 Technical Details

### Mock Data Source
- **File**: `src/lib/mock/performance-data.ts`
- **Audits**: 3 realistic Lighthouse audits (unused-javascript, modern-image-formats, render-blocking-resources)
- **Items**: 13 total files across all audits with realistic metrics

### Components Used
- `PerformanceGrade` - Grade ring visualization
- `CoreWebVitals` - Metrics display with thresholds
- `AIImprovementSuggestions` - Main suggestions component

### Data Flow
```
Mock Data → generateImprovementPlan() → AI Prompts with File Details → UI Display
```

## 🎨 UI/UX Features

- **Responsive Design**: Works on all screen sizes
- **Dark/Light Mode**: Respects theme preferences
- **Color Coding**: Priority levels (Critical/High/Medium/Low)
- **Status Indicators**: Good/Needs Improvement/Poor for metrics
- **Smooth Animations**: Expandable cards with transitions
- **Monospace Code**: AI prompts displayed in code format

## 📝 Notes

- This demo uses **mock data** - no real PageSpeed API calls
- File URLs are realistic but fictional
- Metrics are intentionally poor to showcase improvement opportunities
- All components are the same ones used in real scan reports

## 🚀 Next Steps

After viewing the demo:

1. **Run a real scan** (once rate limit resets) to see actual file-specific data
2. **Deploy to Vercel** with `PAGESPEED_API_KEY` environment variable
3. **Share the demo** with stakeholders to show the feature
4. **Test with different websites** to see variety of performance issues

## 📚 Related Documentation

- `docs/PAGESPEED_AUDITS_ANALYSIS.md` - Audit data structure details
- `docs/PERFORMANCE_SUGGESTIONS_API.md` - API endpoint documentation
- `docs/PHASE_5.5_IMPLEMENTATION.md` - Feature implementation guide

---

**Demo URL**: http://localhost:3001/demo/performance
