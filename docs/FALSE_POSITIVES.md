# Handling False Positives in VibeSafe

**Last Updated:** 2026-05-11  
**Purpose:** Guide for managing false positives in security scan results

---

## 🎯 Overview

False positives occur when the scanner detects a potential security issue that isn't actually a vulnerability in your specific context. This is common in security scanners and VibeSafe provides multiple ways to handle them.

---

## 🔍 What Are False Positives?

**Examples of legitimate false positives:**

1. **Development/Testing URLs** — `http://localhost` or `http://example.com` used in tests
2. **Intentional Configurations** — CORS set to `*` for a public API
3. **Third-Party Libraries** — Known issues in dependencies you can't control
4. **Context-Specific Cases** — Missing CSP on a static landing page
5. **Demo/Placeholder Content** — Sample data that looks like secrets but isn't

---

## 🛠️ Methods to Handle False Positives

### **Option 1: Suppression File** (Recommended)

Create a `.vibesafe-ignore` file in your project root to suppress specific findings.

**Format:**
```yaml
# .vibesafe-ignore
version: 1

suppressions:
  # Suppress by module ID + pattern
  - moduleId: P1-01  # Mixed content
    reason: "Development server uses HTTP intentionally"
    pattern: "http://localhost"
    expires: "2026-12-31"  # Optional: auto-expire suppression
    
  # Suppress by exact evidence match
  - moduleId: P1-05  # CORS misconfiguration
    reason: "Public API requires CORS *"
    evidence: "Access-Control-Allow-Origin: *"
    
  # Suppress entire module for specific URLs
  - moduleId: P1-08  # CSP missing
    reason: "Static landing page doesn't need CSP"
    urlPattern: "^https://example\\.com/$"
    
  # Suppress by severity threshold
  - moduleId: P1-15  # Dependency vulnerabilities
    reason: "Known low-severity issue in transitive dependency"
    maxSeverity: "MEDIUM"
```

**Implementation:** We'll need to create a parser and apply suppressions during scan processing.

---

### **Option 2: Inline Annotations** (Future Feature)

Add comments in your code to suppress specific findings:

```javascript
// vibesafe-ignore: P1-01 - Development URL
const API_URL = 'http://localhost:3000';

/* vibesafe-ignore-next-line: P1-03 - Public demo key */
const DEMO_STRIPE_KEY = 'pk_test_...';
```

**Status:** 🚧 Not yet implemented (Phase 9)

---

### **Option 3: Custom Severity Overrides**

Override severity levels for specific findings in your configuration:

```json
{
  "severityOverrides": {
    "P1-01": {
      "pattern": "localhost",
      "severity": "INFO"
    },
    "P1-05": {
      "urlPattern": "^https://api\\.example\\.com",
      "severity": "LOW"
    }
  }
}
```

**Status:** 🚧 Not yet implemented (Phase 9)

---

### **Option 4: Post-Scan Filtering** (Current Workaround)

Use the API to filter results after scanning:

```typescript
// Filter out false positives in your application
const filteredFindings = scan.findings.filter(finding => {
  // Ignore localhost URLs in development
  if (finding.moduleId === 'P1-01' && finding.evidence?.includes('localhost')) {
    return false;
  }
  
  // Ignore known safe CORS for public API
  if (finding.moduleId === 'P1-05' && finding.location === '/api/public') {
    return false;
  }
  
  return true;
});
```

---

## 📋 Recommended Workflow

### **1. Initial Scan**
```bash
# Run first scan
curl -X POST https://your-domain.com/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### **2. Review Results**
- Check each finding carefully
- Determine if it's a real vulnerability or false positive
- Document your reasoning

### **3. Create Suppressions**
- Add to `.vibesafe-ignore` file
- Include clear reasoning for each suppression
- Set expiration dates for temporary suppressions

### **4. Re-Scan**
```bash
# Scan with suppressions applied
curl -X POST https://your-domain.com/api/v1/scans \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","applySuppressions":true}'
```

### **5. Regular Review**
- Review suppressions quarterly
- Remove outdated suppressions
- Re-evaluate as code changes

---

## 🚨 Important Guidelines

### **DO:**
✅ Document why each suppression is safe  
✅ Set expiration dates on suppressions  
✅ Review suppressions regularly  
✅ Get security team approval for suppressions  
✅ Keep suppressions version-controlled  

### **DON'T:**
❌ Suppress findings just to "pass" the scan  
❌ Use broad pattern matches that might hide real issues  
✅ Suppress critical findings without thorough investigation  
❌ Forget to re-evaluate suppressions after code changes  
❌ Share suppression files across different projects  

---

## 📊 Suppression Reporting

**Track suppressed findings:**
```typescript
{
  "scan": {
    "findings": 23,
    "suppressed": 5,
    "active": 18
  },
  "suppressions": [
    {
      "moduleId": "P1-01",
      "reason": "Development URLs",
      "count": 3,
      "expires": "2026-12-31"
    }
  ]
}
```

---

## 🔧 Implementation Status

| Method | Status | Phase |
|--------|--------|-------|
| `.vibesafe-ignore` file | 🚧 Planned | Phase 9 |
| Inline annotations | 🚧 Planned | Phase 9 |
| Severity overrides | 🚧 Planned | Phase 9 |
| Post-scan filtering | ✅ Available | Now (manual) |
| Suppression reporting | 🚧 Planned | Phase 9 |

---

## 🎯 Next Steps

**For immediate use:**
1. Use post-scan filtering in your application code
2. Document false positives in a spreadsheet or markdown file
3. Share findings with your security team for validation

**Coming in Phase 9:**
1. `.vibesafe-ignore` file support
2. Suppression management UI
3. Suppression history and audit trail
4. Team-based suppression approval workflow

---

## 📝 Example Suppression File

```yaml
# .vibesafe-ignore
# VibeSafe False Positive Suppressions
# Project: MyApp
# Reviewed: 2026-05-11

version: 1

suppressions:
  # Development & Testing
  - moduleId: P1-01
    reason: "Local development server - safe in development"
    pattern: "http://localhost|http://127.0.0.1"
    environments: ["development", "test"]
    
  # Public API Endpoints
  - moduleId: P1-05
    reason: "Public API requires CORS * by design"
    evidence: "Access-Control-Allow-Origin: *"
    urlPattern: "^https://api\\.myapp\\.com/public/"
    approvedBy: "security-team@myapp.com"
    approvedDate: "2026-05-01"
    
  # Third-Party Dependencies
  - moduleId: P1-15
    reason: "Known low-severity issue in chart.js - no fix available"
    pattern: "chart\\.js@3\\.9\\.1"
    maxSeverity: "MEDIUM"
    trackingTicket: "SEC-1234"
    expires: "2026-08-01"
    
  # Static Content
  - moduleId: P1-08
    reason: "Marketing landing page - no dynamic content"
    urlPattern: "^https://myapp\\.com/(?:about|pricing|contact)$"
    notes: "Re-evaluate if we add forms or user input"
```

---

## 📞 Need Help?

**Questions about false positives?**
- Review the finding explanation in the scan report
- Check if it appears in other security scanners
- Consult with your security team
- Review OWASP guidelines for the specific issue

**Unsure if something is a false positive?**
- **When in doubt, treat it as real!**
- Get a second opinion from a security expert
- Test in a safe environment
- Document your investigation process

---

**Status:** 📝 **Documentation complete. Implementation pending Phase 9.**
