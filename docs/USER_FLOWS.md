# VibeSafe User Flows & Features

**Complete documentation of all user journeys, authentication, verification, and integrations**

---

## 📊 Flow Overview

```
Landing Page
    ↓
[Choose Path]
    ↓
┌───────────────┬────────────────┬─────────────────┐
│   Anonymous   │   Sign Up      │   Login         │
│   Quick Scan  │   Create Acct  │   Existing User │
└───────┬───────┴────────┬───────┴────────┬────────┘
        ↓                ↓                ↓
    Scan Only      Verify Domain     Dashboard
        ↓                ↓                ↓
    Report        Continuous Mon.    Scan History
```

---

## 1️⃣ Anonymous Quick Scan Flow

**Purpose:** Allow anyone to scan a public URL without signing up

### User Journey

1. **Landing Page**
   - Enter URL in search box
   - Click "Scan" button
   - No authentication required

2. **Scan Progress** (90 seconds)
   - Animated progress indicators
   - Rotating security facts every 5s
   - Countdown timer (45s → 0s)
   - Module status: ○ Pending → ⏳ Running → ✓ Done

3. **Report Page**
   - View grade (A-F) and score (0-100)
   - Browse 5 tabs: Security, Compliance, Performance, A11y, SEO
   - Expand findings for details
   - Copy AI fix prompts
   - **Limited:** Can't download PDF, no history, no continuous monitoring

4. **Upsell**
   - Banner: "Sign up to save this report and monitor continuously"
   - CTA: "Create Free Account"

### Technical Implementation

```typescript
// Anonymous scan creation
POST /api/v1/scans
{
  "url": "example.com",
  "anonymous": true
}

// Response
{
  "id": "scan_abc123",
  "status": "pending",
  "url": "/scan/scan_abc123"
}
```

**Limitations:**
- No PDF export
- Report expires after 7 days
- No email notifications
- No scan history
- Rate limited: 3 scans per IP per day

---

## 2️⃣ Authentication Flow

**Purpose:** Users create accounts to save scans, download PDFs, and enable continuous monitoring

### Sign Up Options

#### Option 1: OAuth (Recommended)
1. Click "Continue with GitHub" or "Continue with Google"
2. Redirect to provider (GitHub/Google)
3. Authorize VibeSafe permissions:
   - GitHub: Email, profile
   - Google: Email, profile
4. Redirect back to VibeSafe
5. Auto-create account + session
6. Land on Dashboard

#### Option 2: Email/Password
1. Enter email + password
2. Submit form
3. Receive verification email
4. Click link to verify
5. Land on Dashboard

### Login Page Components

```html
<!-- OAuth Buttons -->
<button>Continue with GitHub</button>
<button>Continue with Google</button>

<!-- Divider -->
<div>--- or ---</div>

<!-- Email/Password Form -->
<input type="email" placeholder="you@company.com">
<input type="password" placeholder="••••••••">
<button>Sign In</button>

<!-- Links -->
<a>Forgot password?</a>
<a>Sign up for free</a>

<!-- Trust Indicators -->
<div>
  🛡️ SOC 2 Compliant
  🔒 256-bit SSL
  💰 Free tier available
</div>
```

### Technical Implementation

**OAuth Flow (GitHub):**
```typescript
// 1. Redirect to GitHub
GET https://github.com/login/oauth/authorize
  ?client_id=abc123
  &redirect_uri=https://vibesafe.app/auth/callback/github
  &scope=user:email

// 2. GitHub redirects back
GET /auth/callback/github?code=temp_code_xyz

// 3. Exchange code for token
POST https://github.com/login/oauth/access_token
{
  "client_id": "abc123",
  "client_secret": "secret",
  "code": "temp_code_xyz"
}

// 4. Fetch user profile
GET https://api.github.com/user
Authorization: Bearer <access_token>

// 5. Create/update user in DB
// 6. Create session
// 7. Redirect to dashboard
```

**Email/Password:**
```typescript
// Sign Up
POST /api/auth/signup
{
  "email": "user@company.com",
  "password": "hashed_pw",
  "name": "John Doe"
}

// Send verification email
sendEmail({
  to: user.email,
  subject: "Verify your VibeSafe account",
  link: `https://vibesafe.app/verify?token=${verifyToken}`
})

// Verify
GET /api/auth/verify?token=abc123
// Sets user.emailVerified = true
// Redirects to dashboard

// Login
POST /api/auth/login
{
  "email": "user@company.com",
  "password": "plain_pw"
}
// Compare bcrypt hash
// Create session
// Return JWT token
```

### Session Management

```typescript
// NextAuth.js configuration
export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      // Email/password login
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
  },
}
```

---

## 3️⃣ Dashboard (Logged-In Users)

**Purpose:** Central hub for managing scans, viewing history, and monitoring sites

### Dashboard Components

1. **Header**
   - Title: "Dashboard"
   - CTA: "New Scan" button

2. **Stats Grid** (4 cards)
   - Total Scans: 24 (↑ 12% from last month)
   - Critical Issues: 7 (require immediate attention)
   - Avg. Grade: B (↑ 1 grade improved)
   - Monitored Sites: 3 (with continuous scanning)

3. **Recent Scans List**
   - Each row shows:
     - Grade badge (A-F with color)
     - Site URL
     - Severity summary (2 Critical • 4 High • 3 Medium)
     - Time (2 hours ago, yesterday, 3 days ago)
     - Score (/100)
     - Arrow → (click to view report)
   - Hover effect: Background changes
   - Click: Navigate to full report

4. **Actions**
   - Click "New Scan" → Landing page
   - Click scan row → Full report
   - Click site name → Site detail page (future)

### Technical Implementation

```typescript
// Fetch dashboard data
GET /api/v1/dashboard
Authorization: Bearer <jwt_token>

// Response
{
  "stats": {
    "totalScans": 24,
    "totalScansGrowth": 0.12,
    "criticalIssues": 7,
    "avgGrade": "B",
    "avgGradeImprovement": 1,
    "monitoredSites": 3
  },
  "recentScans": [
    {
      "id": "scan_abc123",
      "url": "example.com",
      "grade": "D",
      "score": 35,
      "summary": { "CRITICAL": 2, "HIGH": 4, "MEDIUM": 3 },
      "createdAt": "2026-05-13T10:00:00Z"
    },
    // ... more scans
  ]
}
```

---

## 4️⃣ DNS Verification Flow

**Purpose:** Prove domain ownership to enable advanced features

### Why Verify?

**Unlocks:**
- ✅ Continuous security monitoring (daily auto-scans)
- ✅ Deeper scans (server-side checks, authenticated endpoints)
- ✅ Custom scan policies & exclusions
- ✅ Email/Slack alerts for new vulnerabilities
- ✅ Compliance reports (SOC 2, ISO 27001 proof)

**Without verification:**
- ❌ One-time scans only
- ❌ Basic public scans (no auth)
- ❌ No alerts
- ❌ Can't claim ownership for compliance

### Two Approaches

#### Approach 1: Technical Users
- Shows all 5 methods side-by-side
- Copy-paste values directly
- No wizard, no hand-holding
- **For:** Developers, DevOps, technical founders

#### Approach 2: Guided (Non-Technical)
- Step 1: Select registrar (GoDaddy, Namecheap, Cloudflare, etc.)
- Step 2: Provider-specific instructions with screenshots
- AI help chatbot available
- **For:** Non-technical founders, marketers, small business owners

---

### Verification Methods (5 Total)

Users choose **ONE method** based on their access level.

#### Method 1: DNS TXT Record

**Steps:**
1. User initiates verification for `example.com`
2. VibeSafe generates unique token: `a8f3e2b9c1d4e5f6`
3. User adds DNS TXT record:
   ```
   Name:  _vibesafe-verify.example.com
   Type:  TXT
   Value: vibesafe-verify=a8f3e2b9c1d4e5f6
   ```
4. User clicks "Verify DNS Record"
5. VibeSafe polls DNS:
   ```bash
   dig TXT _vibesafe-verify.example.com
   ```
6. If record found → ✅ Verified
7. If not found → Wait 5 mins, retry (DNS propagation)

**Technical Implementation:**
```typescript
// Generate verification token
POST /api/v1/domains/example.com/verify/initiate
{
  "method": "dns"
}

// Response
{
  "token": "a8f3e2b9c1d4e5f6",
  "dnsRecord": {
    "name": "_vibesafe-verify.example.com",
    "type": "TXT",
    "value": "vibesafe-verify=a8f3e2b9c1d4e5f6"
  },
  "expiresAt": "2026-05-20T10:00:00Z" // 7 days
}

// Verify DNS
POST /api/v1/domains/example.com/verify/check
{
  "method": "dns",
  "token": "a8f3e2b9c1d4e5f6"
}

// Backend logic
import dns from 'dns/promises';

async function verifyDNS(domain: string, token: string) {
  const records = await dns.resolveTxt(`_vibesafe-verify.${domain}`);
  const expected = `vibesafe-verify=${token}`;
  
  for (const record of records) {
    if (record.join('') === expected) {
      return { verified: true };
    }
  }
  
  return { verified: false, error: 'Record not found' };
}
```

**Best for:** Users with DNS access but no code access
**Use case:** Security consultant, IT admin, agency managing client domain

---

#### Method 2: HTML Meta Tag

**Best for:** Users with code access but no DNS access
**Use case:** Developer on Vercel/Netlify, enterprise dev (IT controls DNS)

**Steps:**
1. User initiates verification
2. VibeSafe generates token: `a8f3e2b9c1d4e5f6`
3. User adds to `<head>`:
   ```html
   <meta name="vibesafe-verify" content="a8f3e2b9c1d4e5f6" />
   ```
4. User deploys site
5. User clicks "Verify Meta Tag"
6. VibeSafe fetches homepage:
   ```bash
   curl https://example.com
   ```
7. Parse HTML, check for meta tag
8. If found → ✅ Verified

**Technical Implementation:**
```typescript
// Verify meta tag
POST /api/v1/domains/example.com/verify/check
{
  "method": "meta",
  "token": "a8f3e2b9c1d4e5f6"
}

// Backend logic
import { JSDOM } from 'jsdom';

async function verifyMetaTag(url: string, token: string) {
  const response = await fetch(`https://${url}`);
  const html = await response.text();
  const dom = new JSDOM(html);
  
  const metaTag = dom.window.document.querySelector(
    'meta[name="vibesafe-verify"]'
  );
  
  if (metaTag?.getAttribute('content') === token) {
    return { verified: true };
  }
  
  return { verified: false, error: 'Meta tag not found' };
}
```

---

#### Method 3: CNAME Record (NEW)

**Best for:** Non-technical users (CNAME UI is simpler in some registrars)
**Use case:** Shopify store owner, WordPress site owner

**Steps:**
1. User initiates verification
2. VibeSafe generates token: `a8f3e2b9c1d4e5f6`
3. User adds CNAME record:
   ```
   Name:  verify.example.com
   Type:  CNAME
   Value: a8f3e2b9c1d4e5f6.verify.vibesafe.app
   ```
4. User clicks "Verify CNAME Record"
5. VibeSafe performs DNS lookup:
   ```bash
   dig CNAME verify.example.com
   ```
6. If points to correct target → ✅ Verified

**Technical Implementation:**
```typescript
async function verifyCNAME(domain: string, token: string) {
  const records = await dns.resolveCname(`verify.${domain}`);
  const expected = `${token}.verify.vibesafe.app`;

  if (records.includes(expected)) {
    return { verified: true };
  }

  return { verified: false, error: 'CNAME not found or incorrect' };
}
```

**Why easier:** Some registrar UIs (like GoDaddy) make CNAME records simpler to add than TXT records.

---

#### Method 4: File Upload (NEW)

**Best for:** Users with server/FTP access but no DNS or code access
**Use case:** Shopify, Wix, Squarespace users with file upload capability

**Steps:**
1. User initiates verification
2. VibeSafe generates token: `a8f3e2b9c1d4e5f6`
3. User creates file `vibesafe-verify.txt` with content:
   ```
   vibesafe-verify=a8f3e2b9c1d4e5f6
   ```
4. User uploads to website root: `https://example.com/vibesafe-verify.txt`
5. User clicks "Verify File Upload"
6. VibeSafe fetches the file:
   ```bash
   curl https://example.com/vibesafe-verify.txt
   ```
7. If content matches → ✅ Verified

**Technical Implementation:**
```typescript
async function verifyFile(domain: string, token: string) {
  const response = await fetch(`https://${domain}/vibesafe-verify.txt`);

  if (!response.ok) {
    return { verified: false, error: 'File not found (404)' };
  }

  const content = await response.text();
  const expected = `vibesafe-verify=${token}`;

  if (content.trim() === expected) {
    return { verified: true };
  }

  return { verified: false, error: 'File content does not match' };
}
```

**Why needed:** Platforms like Shopify allow file uploads but make DNS/code changes difficult for non-technical users.

---

#### Method 5: Email Verification (NEW)

**Best for:** Non-technical users with email access
**Use case:** Small business owner, marketer with admin@ email

**Steps:**
1. User initiates verification
2. VibeSafe generates token: `a8f3e2b9c1d4e5f6`
3. User sends email from one of:
   - `admin@example.com`
   - `webmaster@example.com`
   - `postmaster@example.com`
4. Email details:
   ```
   To: verify@vibesafe.app
   Subject: Verify example.com
   Body: a8f3e2b9c1d4e5f6
   ```
5. User clicks "I've Sent the Email"
6. VibeSafe checks inbox for email from authorized address
7. If email received with correct token → ✅ Verified

**Technical Implementation:**
```typescript
// Email handler (webhook or IMAP polling)
async function handleVerificationEmail(email: IncomingEmail) {
  // Parse email
  const from = email.from; // e.g., admin@example.com
  const domain = from.split('@')[1]; // example.com
  const subject = email.subject;
  const body = email.body.trim();

  // Check if from authorized email
  const authorizedPrefixes = ['admin', 'webmaster', 'postmaster'];
  const prefix = from.split('@')[0];

  if (!authorizedPrefixes.includes(prefix)) {
    return { verified: false, error: 'Email must be from admin@, webmaster@, or postmaster@' };
  }

  // Check subject
  if (!subject.includes(`Verify ${domain}`)) {
    return { verified: false, error: 'Invalid subject line' };
  }

  // Find pending verification for this domain
  const verification = await db.verification.findOne({
    domain,
    token: body,
    status: 'pending'
  });

  if (!verification) {
    return { verified: false, error: 'No pending verification found' };
  }

  // Mark as verified
  await db.verification.update({
    id: verification.id,
    status: 'verified',
    method: 'email',
    verifiedAt: new Date()
  });

  return { verified: true };
}
```

**Why easiest:** Every domain owner has access to `admin@domain.com` email. No technical knowledge needed.

---

### Guided Approach (Non-Technical Users)

**Purpose:** Help non-technical users verify without confusion

#### Step 1: Registrar Selection

**UI shows provider logos:**
- 🌐 GoDaddy
- 💰 Namecheap
- ☁️ Cloudflare
- ▲ Vercel
- 🌊 Netlify
- ❓ Other / Not Sure

**User clicks their provider** → Proceeds to Step 2

#### Step 2: Provider-Specific Instructions

**For GoDaddy:**
```
1. Go to GoDaddy DNS Management
2. Find your domain "example.com" and click "DNS"
3. Scroll to "Records" section
4. Click "Add" button
5. Select "TXT" from Type dropdown
6. In "Name" field, enter: _vibesafe-verify
7. In "Value" field, paste: vibesafe-verify=a8f3e2b9c1d4e5f6
8. Click "Save"
9. Wait 5-30 minutes
10. Click "Verify DNS Record" button below
```

**With screenshots/GIFs** (in real app)

**For Namecheap:**
```
1. Log in to Namecheap
2. Click "Domain List" in left sidebar
3. Find "example.com" and click "Manage"
4. Go to "Advanced DNS" tab
5. Click "Add New Record"
6. Select "TXT Record"
... (similar steps)
```

**For Vercel/Netlify (no DNS access):**
```
⚠️ Note: Vercel doesn't provide DNS management.
Use Method 2: HTML Meta Tag instead.

Switch to "I'm Technical" mode above and follow
the Meta Tag instructions.
```

#### Step 3: AI Help Assistant

**Chat interface:**
```
User: "How do I find DNS settings in GoDaddy?"

AI: 🤖 Here's how to find DNS settings in GoDaddy:

1. Log in to your GoDaddy account
2. Click "My Products" at the top
3. Find your domain (example.com) in the list
4. Click the "..." (three dots) next to it
5. Select "Manage DNS"

[Screenshot showing the exact buttons]

Need help with the next step?
```

**Features:**
- Screenshots specific to provider
- Video tutorials (if available)
- "Copy this value" buttons
- "What if I can't find it?" alternative paths

---

### Verification UI Flow

```
Verification Page
├── Header (Why verify?)
├── Method 1: DNS TXT Record
│   ├── Instructions (3 steps)
│   ├── Copy-paste values
│   └── [Verify DNS Record] button
├── Method 2: HTML Meta Tag
│   ├── Instructions (3 steps)
│   ├── Copy-paste code
│   └── [Verify Meta Tag] button
├── Info Box (Why verify?)
└── [Skip for now] button
```

---

## 5️⃣ Chrome Extension Integration

**Purpose:** Allow users to scan any site with one click from their browser

### Extension Features

1. **Toolbar Icon**
   - Shows VibeSafe shield icon
   - Badge shows site's grade (A-F)
   - Click → Opens popup

2. **Popup UI**
   - Current site: example.com
   - Grade badge + score
   - [Scan This Site] button
   - [View Full Report] button
   - Recent scans list

3. **Context Menu**
   - Right-click any page
   - "Scan with VibeSafe" option
   - Triggers instant scan

4. **Auto-Scan (Pro)**
   - Automatically scans every site you visit
   - Shows security score in toolbar
   - Warns before visiting unsafe sites

### User Flow

```
User visits example.com
    ↓
Extension detects URL
    ↓
[If Pro] Auto-scan in background
    ↓
Badge shows grade: C
    ↓
User clicks extension icon
    ↓
Popup shows: "Score: 72/100, Grade C"
    ↓
User clicks "View Full Report"
    ↓
Opens vibesafe.app/report/scan_abc123
```

### Technical Implementation

**manifest.json:**
```json
{
  "name": "VibeSafe Security Scanner",
  "version": "1.2.0",
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon-48.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

**background.js:**
```typescript
// Context menu
chrome.contextMenus.create({
  id: 'scan-site',
  title: 'Scan with VibeSafe',
  contexts: ['page']
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'scan-site' && tab?.url) {
    const url = new URL(tab.url).hostname;
    
    // Create scan
    const response = await fetch('https://vibesafe.app/api/v1/scans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ url })
    });
    
    const { id } = await response.json();
    
    // Open report page
    chrome.tabs.create({
      url: `https://vibesafe.app/scan/${id}`
    });
  }
});
```

**popup.html:**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>VibeSafe</title>
    <link rel="stylesheet" href="popup.css">
  </head>
  <body>
    <div class="popup">
      <div class="header">
        <img src="icon-48.png" width="32" height="32">
        <div>
          <div class="title">VibeSafe Security</div>
          <div class="version">v1.2.0</div>
        </div>
      </div>

      <div class="current-site">
        <div class="label">Current Site:</div>
        <div class="site-info">
          <div class="grade-badge">C</div>
          <div>
            <div class="site-url" id="currentUrl">example.com</div>
            <div class="site-score">Score: <span id="score">72</span>/100</div>
          </div>
        </div>
      </div>

      <button id="scanBtn" class="scan-btn">Scan This Site</button>
      <button id="reportBtn" class="report-btn">View Full Report</button>
    </div>
    
    <script src="popup.js"></script>
  </body>
</html>
```

**popup.js:**
```typescript
document.getElementById('scanBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url).hostname;
  
  // Create scan
  const response = await fetch('https://vibesafe.app/api/v1/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  const { id } = await response.json();
  
  // Open scan page
  chrome.tabs.create({ url: `https://vibesafe.app/scan/${id}` });
});
```

### Landing Page Integration

**Section on Homepage:**
```html
<section class="chrome-extension">
  <h2>Scan any site in one click</h2>
  <p>Install our Chrome extension to scan any website you visit.</p>
  
  <ul>
    <li>✅ One-click security scan from any page</li>
    <li>✅ Automatic subdomain discovery</li>
    <li>✅ Real-time security score badge</li>
    <li>✅ Export reports to PDF/JSON</li>
  </ul>
  
  <button>Add to Chrome - Free</button>
  <div>⭐️ 4.8/5 rating • 10,000+ users</div>
  
  <!-- Extension mockup screenshot -->
  <img src="/extension-screenshot.png" alt="Extension UI">
</section>
```

---

## 🎯 Complete User Journey Map

### New User (Anonymous)

```
1. Lands on vibesafe.app
2. Enters URL → Quick scan
3. Views report
4. Sees upsell: "Sign up to save this report"
5. Clicks "Sign up"
6. Chooses GitHub OAuth
7. Authorizes
8. Lands on dashboard
9. Sees saved scan in history
10. Clicks "New Scan"
11. Scan prompts: "Verify domain for continuous monitoring?"
12. Chooses DNS verification
13. Adds TXT record
14. Waits 10 minutes
15. Clicks "Verify"
16. ✅ Verified! Continuous monitoring enabled
17. Receives daily email: "New vulnerability found"
18. Installs Chrome extension
19. Right-clicks competitor site → "Scan with VibeSafe"
20. Compares their security to competitor
```

### Existing User (Returning)

```
1. Lands on vibesafe.app
2. Already logged in (session cookie)
3. Redirects to /dashboard
4. Sees 3 monitored sites
5. Site #1 (example.com) shows: "2 new critical issues"
6. Clicks to view report
7. Expands finding: "Stripe key exposed"
8. Copies AI fix prompt
9. Pastes into Cursor
10. Cursor generates fix
11. Deploys fix
12. Runs scan again
13. ✅ Issue resolved
14. Grade improves: D → B
15. Downloads PDF for compliance audit
16. Shares PDF with security team
```

---

## 🔐 Security Considerations

### Authentication
- OAuth tokens stored in httpOnly cookies
- JWT tokens expire after 30 days
- Refresh token rotation
- CSRF protection via SameSite cookies

### DNS Verification
- Tokens expire after 7 days
- One-time use (can't reuse same token)
- Domain ownership checked on every privileged operation

### Extension
- Manifest V3 (latest security standards)
- No eval() or inline scripts
- Content Security Policy enforced
- API key stored in chrome.storage.sync (encrypted)

---

## 📊 Feature Gating

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Quick Scans | 3/day | Unlimited | Unlimited |
| Scan History | 7 days | 90 days | Forever |
| PDF Export | ❌ | ✅ | ✅ |
| Continuous Monitoring | ❌ | 3 sites | Unlimited |
| Chrome Extension | ✅ | ✅ | ✅ |
| API Access | ❌ | 1000 req/mo | Custom |
| Slack/Email Alerts | ❌ | ✅ | ✅ |
| White-label Reports | ❌ | ❌ | ✅ |
| SSO (SAML) | ❌ | ❌ | ✅ |

---

## 🚀 Next Steps

1. Implement OAuth providers (GitHub, Google)
2. Build dashboard API endpoints
3. Create DNS verification system
4. Develop Chrome extension (MVP)
5. Add email notification system
6. Build continuous monitoring cron jobs
7. Implement tier gating logic
8. Create compliance report generator

---

**Status:** Complete flow design ready for implementation
**Last Updated:** 2026-05-13
