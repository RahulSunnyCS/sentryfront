# 🐳 Docker Deployment Guide

Deploy VibeSafe using Docker and Docker Compose for full control and portability.

---

## 🎯 Why Use Docker?

### **Pros:**
- ✅ **Full control** - No vendor lock-in
- ✅ **No timeouts** - Scans can run indefinitely
- ✅ **Consistent** - Same environment everywhere
- ✅ **Portable** - Deploy anywhere (AWS, DigitalOcean, your server)
- ✅ **Cost predictable** - Fixed server costs

### **Cons:**
- ⚠️ **More setup** - You manage infrastructure
- ⚠️ **SSL/HTTPS** - Need to configure yourself (use Nginx/Caddy)
- ⚠️ **Maintenance** - Updates, security patches, backups

---

## 🚀 Quick Start (Local)

### **1. Prerequisites**

- Docker Desktop installed
- Docker Compose installed (included with Docker Desktop)

### **2. Create Environment File**

Create `.env.docker` file:

```bash
# Required
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32

# Optional - LLM Enrichment
ANTHROPIC_API_KEY=sk-ant-your-key-here
LLM_ENRICHMENT_ENABLED=true

# Optional - OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### **3. Start Services**

```bash
# Build and start all services (app, postgres, redis)
docker-compose --env-file .env.docker up -d

# Check logs
docker-compose logs -f app

# Wait for "Ready" message
```

### **4. Run Database Migrations**

```bash
# Run migrations inside the container
docker-compose exec app npx prisma migrate deploy

# Or reset database (dev only)
docker-compose exec app npx prisma migrate reset
```

### **5. Access Application**

Visit: **http://localhost:3000**

---

## 📦 What's Included?

### **Services:**

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | VibeSafe Next.js app |
| **postgres** | 5432 | PostgreSQL database |
| **redis** | 6379 | Redis (for scan queue) |

### **Volumes:**
- `postgres_data` - Persistent database storage
- `redis_data` - Persistent queue data

---

## 🌐 Deploy to Production

### **Option 1: DigitalOcean App Platform**

1. **Create Droplet** (or use App Platform)
2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

3. **Clone Repository:**
   ```bash
   git clone https://github.com/RahulSunnyCS/sentryfront.git
   cd sentryfront
   ```

4. **Create `.env.docker`** (with production values)

5. **Start Services:**
   ```bash
   docker-compose --env-file .env.docker up -d
   ```

6. **Setup HTTPS** (use Caddy or Nginx):
   ```bash
   # Caddy (easiest)
   docker run -d \
     -p 80:80 \
     -p 443:443 \
     -v caddy_data:/data \
     -v caddy_config:/config \
     caddy:latest \
     caddy reverse-proxy --from yourdomain.com --to localhost:3000
   ```

---

### **Option 2: AWS ECS/Fargate**

1. **Build and push image:**
   ```bash
   docker build -t vibesafe .
   docker tag vibesafe:latest <your-ecr-repo>/vibesafe:latest
   docker push <your-ecr-repo>/vibesafe:latest
   ```

2. **Create ECS Task Definition** (use AWS Console or Terraform)

3. **Create ECS Service** with:
   - Task definition above
   - RDS PostgreSQL database
   - ElastiCache Redis
   - ALB for load balancing

---

### **Option 3: Railway** (Easiest Cloud Deploy)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

Railway auto-detects `Dockerfile` and deploys!

---

## 🔧 Configuration

### **Environment Variables**

Set in `.env.docker` or pass directly:

```yaml
# Database (auto-configured in docker-compose)
DATABASE_URL: postgresql://vibesafe:vibesafe_password@postgres:5432/vibesafe

# Auth
NEXTAUTH_URL: https://your-domain.com
NEXTAUTH_SECRET: <generate-with-openssl>

# LLM
ANTHROPIC_API_KEY: sk-ant-...
LLM_ENRICHMENT_ENABLED: true

# Features
PDF_EXPORT_ENABLED: true
TIER_GATING_ENABLED: false

# Monitoring
SENTRY_DSN: https://your-sentry-dsn
```

---

## 🐛 Troubleshooting

### **Container won't start:**
```bash
# Check logs
docker-compose logs app

# Check health
docker-compose ps
```

### **Database connection fails:**
```bash
# Check postgres is healthy
docker-compose ps postgres

# Test connection
docker-compose exec app npx prisma db push
```

### **Playwright/PDF export fails:**
```bash
# Verify Chromium is installed
docker-compose exec app which chromium-browser

# Check environment
docker-compose exec app env | grep PLAYWRIGHT
```

---

## 📊 Performance

### **Resource Requirements:**

| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| App | 1 core | 512MB | 1GB |
| PostgreSQL | 0.5 core | 256MB | 5GB |
| Redis | 0.5 core | 128MB | 1GB |
| **Total** | **2 cores** | **1GB** | **7GB** |

**Recommended:** 2 vCPUs, 2GB RAM

---

## 🎯 Summary

**Docker deployment gives you:**
- ✅ Full control over infrastructure
- ✅ No function timeouts
- ✅ Predictable costs
- ✅ Easy to scale (add more containers)

**Best for:**
- Self-hosting
- Long-running scans
- Custom infrastructure requirements

**Not best for:**
- Quick MVP (use Vercel instead)
- Zero DevOps effort (use Vercel instead)

---

**Next:** See [DEPLOYMENT_COMPARISON.md](DEPLOYMENT_COMPARISON.md) for Vercel vs Docker comparison.
