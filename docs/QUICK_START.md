# ⚡ VibeSafe Quick Start

Get VibeSafe running in under 5 minutes.

---

## 🏃 Super Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Set up database (SQLite, no config needed)
npx prisma migrate dev

# 3. Start dev server
npm run dev

# 4. Open browser
# Visit: http://localhost:3000 (or 3001 if 3000 is in use)

# 5. Test a scan
# Enter "example.com" and click Scan
```

**That's it!** VibeSafe runs with zero configuration.

---

## 🚀 Deploy to Vercel (5 Minutes)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Ready to deploy"
git push origin main

# 2. Go to vercel.com
# - Click "New Project"
# - Import your GitHub repo
# - Add DATABASE_URL (use Vercel Postgres)
# - Click "Deploy"

# 3. Done!
# Your app is live at: https://your-app.vercel.app
```

---

## 🎨 Optional Features

All features are **optional** and disabled by default. Enable what you need:

### AI Explanations (Recommended)
```bash
# .env
ANTHROPIC_API_KEY="sk-ant-xxxxx"
LLM_ENRICHMENT_ENABLED="true"
```
Cost: ~$0.001 per scan (40 findings)

### Payments (Stripe)
```bash
STRIPE_ENABLED="true"
STRIPE_SECRET_KEY="sk_live_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```
Set up products in Stripe Dashboard first.

### Authentication
```bash
AUTH_ENABLED="true"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
GITHUB_ID="xxxxx"        # From GitHub OAuth app
GITHUB_SECRET="xxxxx"
```

### Error Tracking (Recommended)
```bash
SENTRY_ENABLED="true"
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
```
Free tier available at sentry.io

---

## 📋 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create new migration
npx prisma generate      # Regenerate client

# Testing
curl http://localhost:3000/api/health  # Check health

# Compliance
npm run compliance:sbom          # Generate SBOM
npm run compliance:check-licenses # Check licenses
```

---

## 🔍 Test URLs

Try scanning these to see different findings:

- `example.com` - Basic security headers
- `github.com` - Good security posture
- `httpbin.org` - CORS testing
- Your own website!

---

## 📚 Documentation

- **Full Deployment**: `DEPLOYMENT.md`
- **Testing Guide**: `TESTING.md`
- **Launch Summary**: `LAUNCH_SUMMARY.md`
- **Environment Vars**: `.env.example`

---

## 🆘 Troubleshooting

### Port already in use
Next.js will auto-increment (3000 → 3001 → 3002)

### Database errors
```bash
rm prisma/vibesafe.db
npx prisma migrate dev
```

### "Module not found" errors
```bash
npm install
npx prisma generate
```

### Scans timing out
```bash
# Increase timeout in .env
SCAN_TIMEOUT_MS="180000"  # 3 minutes
```

---

## ✅ Success Checklist

- [ ] Server starts (`npm run dev`)
- [ ] Browser opens to localhost
- [ ] Can submit a scan
- [ ] Report displays with findings
- [ ] Health check returns OK (`/api/health`)

**All good?** You're ready to deploy! 🎉

---

## 🚀 What's Running

**Server:** http://localhost:3001 (currently running)  
**API:** http://localhost:3001/api/health  
**Demo:** http://localhost:3001/report/demo  

---

## 💡 Pro Tips

1. **Test with AI enrichment first** - The explanations are much better
2. **Enable Sentry immediately** - Catch errors before users do
3. **Start with Free tier** - Test payments later
4. **Use Vercel Postgres** - Easiest database setup
5. **Set `NEXTAUTH_SECRET`** - Required for production

---

**Need help?** Check `DEPLOYMENT.md` for detailed guides.

**Ready to launch?** Follow `LAUNCH_SUMMARY.md`.

Happy scanning! 🛡️
