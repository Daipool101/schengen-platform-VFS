# Schengen Visa Route Intelligence Platform

A centralized platform for VFS Global agents to search Schengen visa routes and get complete, accurate visa information.

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Supabase project (for database)

### 1. Setup environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, GEMINI_API_KEY, FIRECRAWL_API_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Run database migrations

Go to your Supabase dashboard → SQL Editor → paste and run:
`backend/src/database/migrations/001_initial_schema.sql`

### 3. Start services

```bash
# Start Redis + Backend + Frontend
docker-compose up

# OR run individually for development:
# Terminal 1 — Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 2 — Backend
cd backend && npm install && npm run start:dev

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

### 4. Seed countries data

```bash
curl -X POST http://localhost:3001/countries/seed \
  -H "Content-Type: application/json"
```

### 5. Access the platform
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/health

---

## Architecture

```
Frontend (Next.js)       → http://localhost:3000
Backend API (NestJS)     → http://localhost:3001
Redis (BullMQ + Cache)   → localhost:6379
Database (Supabase/PG)   → cloud
```

## Search Flow

1. User searches India → Austria
2. Backend checks database for existing route data
3. **If exists + fresh (<24h):** Return immediately
4. **If exists + stale (>24h):** Return data + trigger background refresh
5. **If not found:** Return 202 + jobId, frontend polls every 3s
6. Crawler fetches from VFS/official sources via Firecrawl
7. Gemini extracts structured data from crawled content
8. Data saved to Supabase, result returned to user

## Daily Refresh

EventBridge (or cron) triggers at 02:00 UTC daily.
All routes with `last_verified_at > 24h` are queued for refresh.
If content hash changes → data re-extracted + change logged.

## Environment Variables

| Variable | Description |
|---|---|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_SERVICE_KEY | Supabase service role key |
| JWT_SECRET | Secret for signing JWTs |
| GEMINI_API_KEY | Google Gemini API key (for LLM extraction) |
| FIRECRAWL_API_KEY | Firecrawl API key (stealth crawler) |
| REDIS_HOST | Redis hostname (default: localhost) |
| REDIS_PORT | Redis port (default: 6379) |
| EXCHANGE_RATE_API_KEY | Optional — open.er-api.com (free tier works without key) |

## Build Phases

- [x] Phase 1 — Foundation: DB schema, NestJS scaffold, auth, countries
- [x] Phase 2 — Crawler Pipeline: Firecrawl + BullMQ + Gemini extraction
- [x] Phase 3 — Core APIs: Route search, requirements, documents, VAC, rates
- [x] Phase 4 — Frontend: Next.js, search page, results page, auth
- [ ] Phase 5 — Freshness Engine: Daily scheduler, hash diff, change log
- [ ] Phase 6 — AWS Deploy: ECS, CloudFront, ElastiCache, CI/CD
