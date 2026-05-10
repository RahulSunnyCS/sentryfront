# PageSpeed Insights API Setup Guide

## Overview

VibeSafe uses Google PageSpeed Insights API for performance scanning. This replaces direct Lighthouse integration to work in serverless environments (Vercel, Netlify, etc.).

**Legal Status**: ✅ **Allowed for commercial use** under Google APIs Terms of Service  
**Cost**: ✅ **100% FREE** (25,000 requests/day, no paid tier exists)  
**Fail-Safe**: ✅ If API fails or hits rate limit, security scan continues with empty performance data

---

## Quick Setup (5 minutes)

### Option A: Without API Key (Simple, Lower Quota)
**No setup needed!** Performance scanning will work but with very limited quota.

**Limitations**:
- Very low rate limits
- No usage tracking
- May hit quota faster

### Option B: With API Key (Recommended, Full 25k/day Quota)

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "VibeSafe" (or anything)
4. Click "Create"

#### Step 2: Enable PageSpeed Insights API
1. Go to [PageSpeed Insights API](https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com)
2. Click "Enable"
3. Wait 1-2 minutes for activation

#### Step 3: Create API Key
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "API Key"
3. Copy the API key (looks like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

#### Step 4: Configure VibeSafe
1. Open `.env` file
2. Set your API key:
```env
PAGESPEED_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```
3. Restart your server: `npm run dev` or redeploy

**Done!** You now have full 25,000 requests/day quota.

---

## Rate Limits & Quotas

| Tier | Requests/Day | Requests/Minute | Cost | Setup |
|------|--------------|-----------------|------|-------|
| **No API Key** | Very limited | ~10-20 | Free | None |
| **With API Key** | 25,000 | ~240 | Free | 5 min setup |

**Note**: There is NO paid tier. If you need more than 25k/day, you can:
- Create multiple Google Cloud projects (each gets 25k/day)
- Request quota increase from Google (manually reviewed, sometimes approved)

---

## Testing Your Setup

### Test 1: Check API Key Works
```bash
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_API_KEY"
```

**Expected**: JSON response with Lighthouse data  
**If error**: API not enabled or invalid key

### Test 2: Run VibeSafe Scan
```bash
curl -X POST http://localhost:3001/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Check logs for:
```
[INFO] Calling PageSpeed Insights API
[INFO] PageSpeed Insights API call successful
```

---

## Troubleshooting

### Error: "Quota exceeded"
**Cause**: API not enabled or daily limit hit  
**Fix**:
1. Enable PageSpeed Insights API in Google Cloud Console
2. Wait 1-2 minutes
3. Try again
4. If still failing: you may have hit daily limit (wait 24 hours)

### Error: "Invalid API key"
**Cause**: Wrong key or API restrictions  
**Fix**:
1. Check key in `.env` matches Google Cloud Console
2. Ensure no extra spaces/quotes
3. Create a new API key if needed

### Performance data missing in scan results
**Expected behavior!** If PageSpeed API fails (rate limit, network error, etc.), VibeSafe **fails safely**:
- Security scan continues normally
- Performance grade/score will be null
- No performance findings
- Check logs for PageSpeed API errors

---

## Production Deployment (Vercel/Netlify)

### Vercel
1. Go to your project settings
2. Environment Variables → Add:
```
PAGESPEED_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```
3. Redeploy

### Netlify
1. Site settings → Environment variables
2. Add `PAGESPEED_API_KEY`
3. Redeploy

---

## FAQ

**Q: Is this legal for commercial use?**  
A: ✅ Yes! Google APIs Terms allow commercial use.

**Q: What happens if I hit rate limit?**  
A: Scan continues with security findings only. Performance data will be empty.

**Q: Can I get more than 25k requests/day?**  
A: Create multiple Google Cloud projects or request quota increase from Google.

**Q: Do I need billing enabled?**  
A: No! PageSpeed Insights API is 100% free.

**Q: What if Google deprecates this API?**  
A: We can easily switch to other providers (WebPageTest API, Lighthouse CI, etc.)

---

## Alternative: Disable Performance Scanning

If you don't want to use PageSpeed Insights API:

```env
PERFORMANCE_SCANNING_ENABLED="false"
```

VibeSafe will work perfectly with security scanning only!
