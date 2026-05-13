# Chrome Extension Specification

**VibeSafe Browser Extension - Authenticated Page Scanning**  
**Version:** 1.0  
**Last Updated:** 2026-05-13  
**Status:** In Development (Q1 2026)

---

## 1. Product Overview

### 1.1 Purpose

The VibeSafe Chrome Extension solves a critical limitation: **scanning authenticated pages** (dashboards, admin panels, user-specific content) that require login.

**Current Problem:**
- Main VibeSafe scanner only scans public URLs
- Can't access `/admin`, `/dashboard`, `/account` pages
- Misses security issues in authenticated areas

**Extension Solution:**
- Uses your existing browser session (cookies/auth)
- Records multi-page user flows
- Analyzes authenticated pages without credentials

---

### 1.2 Key Features

**✅ MVP (Q1 2026)**
1. Start/stop session recording
2. Capture 1-5 pages per session
3. Collect HTML, headers, console errors
4. Send data to VibeSafe API for analysis
5. View results in popup or new tab

**🚧 Future**
- Visual issue highlighting on page
- Screenshot comparison (before/after fixes)
- Automated user flow testing
- CI/CD integration (Puppeteer mode)

---

## 2. Architecture

### 2.1 Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "VibeSafe Scanner",
  "version": "1.0.0",
  "description": "Scan authenticated pages for security, performance, and accessibility issues",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "host_permissions": [
    "https://vibesafe.app/*"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

### 2.2 Component Breakdown

**1. Background Service Worker** (`background.js`)
- Manage recording state
- Collect data from content scripts
- Send data to API
- Handle authentication with VibeSafe

**2. Content Script** (`content.js`)
- Inject into every page
- Listen for recording commands
- Capture DOM snapshots
- Monitor network requests
- Log console errors

**3. Popup UI** (`popup.html`)
- Start/stop recording button
- Page counter (3/5 pages recorded)
- "Analyze Now" button
- Settings (API key, auto-upload)

**4. API Client** (`api.js`)
- Authenticate with VibeSafe
- Upload page data
- Poll for scan results

---

## 3. User Flow

### 3.1 First-Time Setup

```
1. Install extension from Chrome Web Store
   ↓
2. Click extension icon → "Login to VibeSafe"
   ↓
3. Opens vibesafe.app/extension/auth
   ↓
4. User logs in (existing account or signup)
   ↓
5. Page generates API key → sends to extension
   ↓
6. Extension stores API key in chrome.storage
   ↓
7. Ready to scan! ✅
```

---

### 3.2 Scanning Flow

```
1. User navigates to app (e.g., admin dashboard)
   ↓
2. Clicks extension → "Start Recording"
   ↓
3. Extension icon turns red (recording indicator)
   ↓
4. User navigates through pages:
   - /dashboard
   - /users
   - /settings
   (Content script captures each page)
   ↓
5. User clicks "Stop Recording"
   ↓
6. Popup shows: "3 pages recorded. Analyze now?"
   ↓
7. User clicks "Analyze"
   ↓
8. Background worker:
   - Bundles all page data
   - Sends to /api/v1/extension/scan
   ↓
9. Server runs analysis (same as URL scans)
   ↓
10. Extension polls for results
    ↓
11. Shows notification: "Scan complete! Grade: B"
    ↓
12. Click notification → Opens results in new tab
```

---

## 4. Data Collection

### 4.1 What We Collect

**Per Page:**
```json
{
  "url": "https://app.example.com/dashboard",
  "timestamp": "2026-05-13T10:00:00Z",
  "html": "<html>...</html>",
  "headers": {
    "content-type": "text/html",
    "set-cookie": "REDACTED"
  },
  "resources": [
    {
      "url": "https://cdn.example.com/app.js",
      "type": "script",
      "size": 125000
    }
  ],
  "consoleErrors": [
    "TypeError: Cannot read property 'foo' of undefined"
  ],
  "performance": {
    "lcp": 2500,
    "fcp": 1200,
    "cls": 0.05
  }
}
```

---

### 4.2 What We DON'T Collect

**Privacy-First Design:**

❌ Form data (passwords, credit cards)  
❌ Cookies/session tokens  
❌ LocalStorage/SessionStorage  
❌ Personal user information  
❌ Input values  
❌ Private messages/content

**Redaction:**
- All `Set-Cookie` headers → `REDACTED`
- Authorization headers → `REDACTED`
- Passwords/tokens in HTML → Stripped before upload

---

## 5. Security & Privacy

### 5.1 Data Transmission

**Encryption:**
- All data sent over HTTPS only
- API key stored in `chrome.storage.local` (encrypted by Chrome)

**Authentication:**
```typescript
fetch("https://vibesafe.app/api/v1/extension/scan", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(pageData)
});
```

---

### 5.2 User Consent

**Permission Requests:**

1. **`activeTab`** - Access current tab HTML/DOM
   - **Why:** Need to read page content
   - **Shown when:** User clicks "Start Recording"

2. **`storage`** - Store API key locally
   - **Why:** Remember authentication
   - **Shown on:** Install

3. **`host_permissions` (vibesafe.app)** - Send data to API
   - **Why:** Upload page data for analysis
   - **Shown on:** Install

**Data Retention:**
- Page data deleted after scan completes
- API key stored until user logs out
- Scan results follow main app retention (90 days)

---

## 6. Technical Implementation

### 6.1 Content Script (Simplified)

```typescript
// content.js

let isRecording = false;

// Listen for recording commands from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    isRecording = true;
    capturePage();
  }
  
  if (message.action === "stopRecording") {
    isRecording = false;
  }
});

const capturePage = () => {
  const pageData = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    html: document.documentElement.outerHTML,
    
    // Capture performance metrics
    performance: {
      lcp: performance.getEntriesByType("largest-contentful-paint")[0]?.startTime,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
      cls: getCLS()
    },
    
    // Capture console errors
    consoleErrors: window.__vibesafe_errors || []
  };
  
  // Send to background worker
  chrome.runtime.sendMessage({
    action: "pageCapture",
    data: pageData
  });
};

// Monitor console errors
const originalError = console.error;
window.__vibesafe_errors = [];

console.error = (...args) => {
  window.__vibesafe_errors.push(args.join(" "));
  originalError.apply(console, args);
};
```

---

### 6.2 Background Service Worker

```typescript
// background.js

let recordedPages = [];

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "pageCapture") {
    recordedPages.push(message.data);
    
    // Update badge
    chrome.action.setBadgeText({ 
      text: String(recordedPages.length) 
    });
  }
  
  if (message.action === "analyzeNow") {
    uploadAndAnalyze();
  }
});

const uploadAndAnalyze = async () => {
  const apiKey = await chrome.storage.local.get("vibesafe_api_key");
  
  const response = await fetch("https://vibesafe.app/api/v1/extension/scan", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ pages: recordedPages })
  });
  
  const { scanId } = await response.json();
  
  // Poll for results
  pollScanResults(scanId);
};
```

---

## 7. Future Enhancements

**Q2 2026:**
- Firefox & Edge support (same codebase, different manifests)
- Visual issue highlighting (overlay on page)
- Export to PDF directly from extension

**Q3 2026:**
- Automated user flows (record once, replay for testing)
- Screenshot comparison
- Integration with CI/CD (headless mode)

---

**Document Owner:** Extension Team  
**Status:** In Development  
**Target Launch:** Q1 2026
