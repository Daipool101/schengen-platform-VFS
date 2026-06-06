# Deploying to AWS EC2 (Free Tier)

This guide deploys the whole platform (frontend + backend + Redis) onto **one EC2 instance** using Docker Compose, behind Nginx. Supabase stays in the cloud.

```
Internet → EC2 (port 80) → Nginx ┬→ /     → Frontend (Next.js)
                                  └→ /api  → Backend (NestJS) → Redis (local container)
```

---

## Part 0 — Push your code to GitHub (from your laptop)

> Your `.env` is git-ignored, so your API keys will NOT be uploaded. You'll create the `.env` directly on the server in Part 4.

```bash
cd C:\Users\Akash\Downloads\schengen-platform

git init
git add .
git commit -m "Initial commit - Schengen platform"

# Create a new repo on github.com first (e.g. schengen-platform), then:
git remote add origin https://github.com/YOUR_USERNAME/schengen-platform.git
git branch -M main
git push -u origin main
```

If the repo is **private** (recommended), you'll need a GitHub Personal Access Token when cloning on the server.

---

## Part 1 — Launch the EC2 instance

1. Go to **AWS Console → EC2 → Launch instance**
2. **Name:** `schengen-platform`
3. **OS image:** Ubuntu Server 24.04 LTS (free tier eligible)
4. **Instance type:** `t3.micro` (or `t2.micro`) — free tier
5. **Key pair:** Create a new one named `schengen-key`, download the `.pem` file, keep it safe
6. **Network settings → Edit → Add security group rules:**
   | Type       | Port | Source        | Why                |
   |------------|------|---------------|--------------------|
   | SSH        | 22   | My IP         | so you can log in  |
   | HTTP       | 80   | Anywhere 0.0.0.0/0 | public website |
7. **Storage:** bump to **20 GB** (default 8GB is too small for Docker images)
8. Click **Launch instance**
9. Once running, copy the **Public IPv4 address** (e.g. `13.51.xx.xx`)

---

## Part 2 — Connect to the instance

From your laptop (PowerShell), in the folder where your `.pem` is:

```bash
# Lock down the key file permissions (first time only)
icacls schengen-key.pem /inheritance:r
icacls schengen-key.pem /grant:r "%USERNAME%:R"

# SSH in (replace with your public IP)
ssh -i schengen-key.pem ubuntu@13.51.xx.xx
```

Type `yes` when asked about the fingerprint.

---

## Part 3 — Install Docker + add swap (run ON the server)

Copy-paste this whole block into the SSH session:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker + Docker Compose plugin
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu

# --- IMPORTANT: add 2GB swap so the 1GB instance doesn't crash during build ---
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Apply the docker group change
exit
```

Then **SSH back in** (so the docker group takes effect):

```bash
ssh -i schengen-key.pem ubuntu@13.51.xx.xx
```

Verify: `docker ps` should run without "permission denied".

---

## Part 4 — Get the code + create secrets

```bash
# Clone your repo (use your real URL)
git clone https://github.com/YOUR_USERNAME/schengen-platform.git
cd schengen-platform

# Create the backend .env on the server (it was NOT committed)
nano backend/.env
```

Paste your environment variables into nano (the REDIS_URL line will be auto-overridden to local Redis by the prod compose, so its value here doesn't matter):

```
SUPABASE_URL=https://ywpsijrcsvfsyczsqjmx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=change-this-to-something-long-and-random
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your-gemini-key
FIRECRAWL_API_KEY=your-firecrawl-key
REDIS_URL=redis://redis:6379
EXCHANGE_RATE_API_KEY=
PORT=3001
NODE_ENV=production
```

Save in nano: **Ctrl+O → Enter → Ctrl+X**

---

## Part 5 — Build and run

```bash
# Build all images and start everything in the background
docker compose -f docker-compose.prod.yml up -d --build
```

This takes **5-10 minutes** the first time (building Next.js + NestJS). 

Check it's running:

```bash
docker compose -f docker-compose.prod.yml ps     # all should be "Up"
docker compose -f docker-compose.prod.yml logs -f # watch logs (Ctrl+C to exit)
```

---

## Part 6 — Open your site 🎉

In your browser:

```
http://13.51.xx.xx        ← your EC2 public IP
```

- Login page → `agent@vfs.com` / `Agent@1234`
- Search a route → it works!
- API health check: `http://13.51.xx.xx/api/health`

---

## Updating later (after code changes)

On your laptop:
```bash
git add . && git commit -m "your change" && git push
```

On the server:
```bash
cd schengen-platform
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Useful commands (on the server)

```bash
# View logs of one service
docker compose -f docker-compose.prod.yml logs -f backend

# Restart everything
docker compose -f docker-compose.prod.yml restart

# Stop everything
docker compose -f docker-compose.prod.yml down

# See memory usage
free -h
docker stats
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build killed / out of memory | Make sure the 2GB swap from Part 3 is active: `free -h` |
| Site won't load | Check security group allows port 80 from Anywhere |
| `permission denied` on docker | You forgot to SSH back in after Part 3 |
| Backend can't reach Redis | Check `REDIS_URL=redis://redis:6379` in backend/.env |
| 502 Bad Gateway | Backend still starting — wait 30s, check `docker compose logs backend` |

---

## Optional next steps (later)

- **Free domain + HTTPS:** point a domain at the IP, add Certbot/Let's Encrypt to Nginx
- **Elastic IP:** so the public IP doesn't change if you restart the instance
- **Swap Gemini → Ollama:** as planned, after deployment is stable
