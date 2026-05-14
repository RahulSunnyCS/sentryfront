# VibeSafe Domain Verification Guide

**Complete guide for both technical and non-technical users**

---

## 🎯 Quick Overview

**Why verify?** Unlock continuous monitoring, deeper scans, email alerts, and compliance reports.

**Choose ONE method** based on what you have access to. You don't need to complete all 5 methods!

---

## 📊 Method Comparison Table

| Method | Best For | Access Required | Difficulty | Time to Verify |
|--------|----------|----------------|-----------|----------------|
| **1. DNS TXT Record** | Technical users with DNS access | DNS management | Medium | 5-30 mins |
| **2. HTML Meta Tag** | Developers who can deploy code | Code/deployment access | Easy | Instant |
| **3. CNAME Record** | Non-technical users (simpler UI) | DNS management | Easy | 5-30 mins |
| **4. File Upload** | Shopify/Wix/Squarespace users | FTP/file upload access | Very Easy | Instant |
| **5. Email** | Anyone with admin@ email | Email access | Easiest | 5-10 mins |

---

## 🚀 Quick Start

### For Technical Users
1. Click **"I'm Technical"** button
2. Scan the 5 methods
3. Pick the easiest one for you
4. Copy-paste the values
5. Click verify

### For Non-Technical Users
1. Click **"Guide Me Through It"** button
2. Select your domain registrar (GoDaddy, Namecheap, etc.)
3. Follow step-by-step instructions with screenshots
4. Click "Ask AI" if stuck
5. Click verify

---

## 📋 Method Details

### Method 1: DNS TXT Record
✅ **Best if:** You have DNS access (registrar account)  
❌ **Skip if:** You can't edit DNS or don't know your registrar login

**What to add:**
```
Name:  _vibesafe-verify.example.com
Type:  TXT
Value: vibesafe-verify=a8f3e2b9c1d4e5f6
```

**Who should use this:**
- Security consultant verifying client domain
- IT admin (has registrar access, not code access)
- Agency managing client DNS

---

### Method 2: HTML Meta Tag
✅ **Best if:** You can deploy code/HTML changes  
❌ **Skip if:** You can't edit your website's HTML

**What to add:**
```html
<meta name="vibesafe-verify" content="a8f3e2b9c1d4e5f6" />
```
*Add to your `<head>` section*

**Who should use this:**
- Developer (can deploy, but IT controls DNS)
- Using Vercel/Netlify (managed DNS, can't add custom records)
- Have GitHub access but not registrar access

---

### Method 3: CNAME Record
✅ **Best if:** You find CNAME simpler than TXT (some registrars do)  
❌ **Skip if:** You can't access DNS

**What to add:**
```
Name:      verify.example.com
Type:      CNAME
Points to: a8f3e2b9c1d4e5f6.verify.vibesafe.app
```

**Why this exists:**
Some registrar UIs (like GoDaddy's) make CNAME records easier to understand than TXT records. If you're comfortable with DNS but TXT seems confusing, try CNAME.

---

### Method 4: File Upload
✅ **Best if:** You can upload files but can't edit DNS or HTML  
❌ **Skip if:** You don't have FTP/file upload access

**What to do:**
1. Create a file named `vibesafe-verify.txt`
2. Add this line: `vibesafe-verify=a8f3e2b9c1d4e5f6`
3. Upload to your website root
4. Should be accessible at: `https://example.com/vibesafe-verify.txt`

**Who should use this:**
- Shopify store owner (can upload files via admin)
- Wix/Squarespace user (limited HTML/DNS access)
- WordPress user with FTP but not theme editor access

---

### Method 5: Email Verification
✅ **Best if:** You have access to admin@ email  
❌ **Skip if:** You don't control admin@, webmaster@, or postmaster@ emails

**What to do:**
1. Send email **from** one of these addresses:
   - `admin@example.com`
   - `webmaster@example.com`
   - `postmaster@example.com`
2. Send **to:** `verify@vibesafe.app`
3. **Subject:** Verify example.com
4. **Body:** `a8f3e2b9c1d4e5f6`
5. Click "I've Sent the Email" button

**Who should use this:**
- Small business owner (has email, not technical)
- Marketer (can access admin@ but not DNS/code)
- Solo founder (easiest method, no DNS knowledge needed)

---

## 🎓 Guided Approach (Non-Technical)

### Step 1: Select Your Provider
Choose where your domain is registered:

- **GoDaddy** - World's largest registrar
- **Namecheap** - Popular budget registrar
- **Cloudflare** - DNS + CDN provider
- **Vercel** - Deployment platform (use Meta Tag method)
- **Netlify** - Deployment platform
- **Other / Not Sure** - Generic instructions

### Step 2: Follow Provider-Specific Guide
We show you exact steps for your provider:

**Example for GoDaddy users:**
```
1. Go to GoDaddy DNS Management ↗️
2. Find "example.com" and click "DNS"
3. Click "Add" button
4. Select "TXT" from dropdown
5. Name: _vibesafe-verify
6. Value: vibesafe-verify=a8f3e2b9c1d4e5f6
7. Click "Save"
8. Wait 10 minutes
9. Come back and click "Verify"
```

*With screenshots, highlighting exactly which buttons to click*

### Step 3: Get AI Help (If Stuck)
Click **"Ask AI"** button to chat:

```
You: "I can't find the DNS settings in GoDaddy"

AI: 🤖 Here's how to find it:
    1. Log in to GoDaddy
    2. Click "My Products" at the top
    3. Find your domain in the list
    4. Click the "..." menu
    5. Select "Manage DNS"
    
    [Shows screenshot with arrows pointing to buttons]
    
    Still can't find it?
```

---

## ❓ FAQ

### Which method should I use?
**Choose based on what you have access to:**
- Have DNS login? → **Method 1 (TXT) or Method 3 (CNAME)**
- Can deploy code? → **Method 2 (Meta Tag)**
- Have FTP only? → **Method 4 (File Upload)**
- Have email only? → **Method 5 (Email)**

### Do I need to complete all 5 methods?
**No!** Pick ONE method. They all prove ownership individually.

### How long does verification take?
- **DNS methods:** 5-30 minutes (DNS propagation time)
- **Meta Tag:** Instant (as soon as you deploy)
- **File Upload:** Instant (as soon as file is uploaded)
- **Email:** 5-10 minutes (email processing time)

### What if I don't have access to any of these?
**Options:**
1. Ask your IT department for temporary DNS access
2. Ask your developer to add the meta tag
3. Use email method (most people have admin@ email)
4. Contact support@vibesafe.app for alternative verification

### Can I verify later?
**Yes!** You can skip verification and still use basic scans. Verification is only needed for:
- Continuous monitoring (daily auto-scans)
- Email/Slack alerts
- Deeper scans (authenticated endpoints)
- Compliance reports (SOC 2, ISO 27001)

---

## 🎯 Real-World Scenarios

### Scenario 1: Solo Developer
**Access:** ✅ DNS, ✅ Code, ✅ Email, ✅ FTP  
**Best method:** Method 2 (Meta Tag) - fastest for developers

### Scenario 2: Security Consultant
**Access:** ✅ DNS (client gave login), ❌ Code  
**Best method:** Method 1 (DNS TXT)

### Scenario 3: Shopify Store Owner
**Access:** ❌ DNS (Shopify manages), ⚠️ Limited HTML, ✅ File upload  
**Best method:** Method 4 (File Upload)

### Scenario 4: Small Business Owner
**Access:** ❌ DNS, ❌ Code, ❌ FTP, ✅ Email  
**Best method:** Method 5 (Email) - easiest!

### Scenario 5: Enterprise Developer
**Access:** ❌ DNS (IT controls), ✅ Code (can deploy)  
**Best method:** Method 2 (Meta Tag)

---

## 🚀 Next Steps

1. ✅ Choose your method above
2. ✅ Follow the instructions
3. ✅ Wait for DNS propagation (if using DNS methods)
4. ✅ Click "Verify" button
5. ✅ Unlock continuous monitoring!

**Need help?** Click "Guide Me Through It" for step-by-step wizard.

---

**Last updated:** 2026-05-13  
**Questions?** support@vibesafe.app
