# VibeSafe Testing Guide

Complete guide for testing all VibeSafe features before deployment.

---

## 🧪 Local Testing Checklist

### ✅ **1. Basic Scan Test**

**Test URL:** `example.com`

**Steps:**
1. Open `http://localhost:3001`
2. Enter `example.com` in the input field
3. Click "Scan" or press Enter
4. Watch the progress indicators
5. Verify the report loads

**Expected Results:**
- Progress screen shows 15 modules
- Scan completes in ~10-20 seconds
- Report displays:
  - Grade (A-F)
  - Security score
  - Finding count by severity
  - List of findings with details

**Common Findings for example.com:**
- Headers: Missing security headers (CSP, etc.)
- TLS: Should show certificate info
- Cookies: Minimal or none

---

### ✅ **2. Test All 15 Modules**

Test URLs that trigger different modules:

#### **Secrets (P1-01)**
- Test URL: Look for sites with exposed `.env` files
- Expected: Detects API keys, secrets in JS bundles

#### **Sourcemaps (P1-02)**
- Test URL: Many production sites
- Expected: Flags if `.js.map` files are publicly accessible

#### **Headers (P1-03)**
- Test URL: `example.com`
- Expected: Reports missing CSP, HSTS, X-Frame-Options

#### **TLS (P1-04)**
- Test URL: Any HTTPS site
- Expected: Shows TLS version, cipher suite, cert validity

#### **Cookies (P1-05)**
- Test URL: Sites with login (e.g., `github.com`)
- Expected: Reports missing Secure, HttpOnly, SameSite flags

#### **Sensitive Paths (P1-06)**
- Test URL: Various sites
- Expected: Checks for `.env`, `/admin`, `/.git/config`

#### **CORS (P1-07)**
- Test URL: `httpbin.org`
- Expected: Tests CORS configuration

#### **Mixed Content (P1-08)**
- Test URL: Sites mixing HTTP/HTTPS resources
- Expected: Flags insecure resources on HTTPS pages

#### **Third-Party Scripts (P1-09)**
- Test URL: News sites, blogs
- Expected: Lists analytics, ad networks, CDNs

#### **DNS/Email (P1-10)**
- Test URL: Any domain
- Expected: Checks SPF, DMARC records

#### **Subdomain Takeover (P1-11)**
- Test URL: Domains with many subdomains
- Expected: Detects dangling CNAMEs

#### **Error Disclosure (P1-12)**
- Test URL: Sites with exposed dev endpoints
- Expected: Finds stack traces, error pages

#### **Dev Interfaces (P1-13)**
- Test URL: GraphQL APIs
- Expected: Detects `/graphql`, `/__debug__`, etc.

#### **Robots/Sitemap (P1-14)**
- Test URL: Any site with `robots.txt`
- Expected: Parses disallowed paths

#### **Cache (P1-15)**
- Test URL: Sites with authentication
- Expected: Checks Cache-Control headers

---

### ✅ **3. Test Features**

#### **LLM Enrichment (Phase 5)**
**With API Key:**
```bash
# Add to .env
ANTHROPIC_API_KEY="sk-ant-xxxxx"
LLM_ENRICHMENT_ENABLED="true"
```
- Run a scan
- Check findings have detailed explanations
- Verify AI fix prompts are present

**Without API Key:**
- Remove `ANTHROPIC_API_KEY` from .env
- Run a scan
- Verify scan still completes (fail-open behavior)
- Findings show basic deterministic explanations

#### **Rate Limiting (Phase 8)**
1. Submit 5-10 scans rapidly
2. After 10 scans (default limit), should get HTTP 429
3. Response includes:
   - `X-RateLimit-Limit: 10`
   - `X-RateLimit-Remaining: 0`
   - `Retry-After: <seconds>`

#### **Scan Timeout (Phase 8)**
- Set `SCAN_TIMEOUT_MS=5000` (5 seconds)
- Scan a slow site
- Verify scan stops at 5s with TIMEOUT status

---

### ✅ **4. Test API Endpoints**

#### **Health Check**
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "dev",
  "db": { "type": "sqlite", "status": "ok" },
  "queue": "in-process",
  "features": {
    "scanDiff": false,
    "pdfExport": false,
    "stripe": false,
    "auth": false,
    "tierGating": false,
    "llmEnrichment": false
  },
  "monitoring": { "sentry": false }
}
```

#### **Create Scan**
```bash
curl -X POST http://localhost:3001/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"example.com"}'
```

Expected:
```json
{
  "id": "clxxx...",
  "status": "QUEUED",
  "targetUrl": "https://example.com"
}
```

#### **Get Scan Status**
```bash
curl http://localhost:3001/api/v1/scans/<scan-id>
```

#### **Get Findings**
```bash
curl http://localhost:3001/api/v1/scans/<scan-id>/findings
```

---

### ✅ **5. Test UI Components**

#### **Landing Page**
- Hero section displays correctly
- URL input works
- Feature cards visible
- Tools strip shows AI coding tools

#### **Scanning Screen**
- Progress bar animates
- Module names appear sequentially
- Real-time updates via SSE
- Redirects to report when complete

#### **Report Page**
- Grade ring animates
- Severity summary accurate
- Findings expandable/collapsible
- Copy buttons work
- Filter pills work (ALL/CRITICAL/HIGH/etc.)

#### **Legal Pages**
- `/legal/terms` - Terms of Service loads
- `/legal/privacy` - Privacy Policy loads
- `/legal/contact` - Contact page loads

---

## 🚀 Pre-Production Tests

Before deploying to production:

### Security Tests
- [ ] Test URL validator blocks private IPs
- [ ] Test URL validator blocks cloud metadata (169.254.169.254)
- [ ] Test rate limiting works
- [ ] Test scan timeout enforcement
- [ ] Verify secrets are redacted in findings

### Performance Tests
- [ ] Scan 10 different websites
- [ ] All scans complete under 30 seconds
- [ ] No memory leaks (run 50+ scans)
- [ ] Database grows reasonably (check `vibesafe.db` size)

### Error Handling
- [ ] Test with invalid URLs
- [ ] Test with unreachable domains
- [ ] Test with DNS resolution failures
- [ ] Test with timeout scenarios

---

## 📊 Success Criteria

Before marking testing complete:
- ✅ At least 10 successful scans completed
- ✅ All 15 modules executed at least once
- ✅ No critical errors in console/logs
- ✅ Report UI renders correctly
- ✅ Rate limiting works as expected
- ✅ Health check returns OK

---

## 🐛 Common Issues

### "Scan timeout" errors
- Increase `SCAN_TIMEOUT_MS` in .env
- Check network connectivity
- Verify target site is responsive

### No findings shown
- Check browser console for errors
- Verify `/api/v1/scans/<id>/findings` returns data
- Check database for findings records

### Rate limit errors
- Wait for rate limit window to expire (1 hour)
- Or increase `RATE_LIMIT_PER_HOUR` in .env

### Database errors
- Run `npx prisma migrate dev`
- Check `DATABASE_URL` is correct
- Verify `vibesafe.db` file exists

---

## ✅ Mark Testing Complete

Once all tests pass:
```bash
# Create a test report
echo "✅ All tests passed on $(date)" > TEST_RESULTS.txt
```

**Ready for deployment! 🎉**
