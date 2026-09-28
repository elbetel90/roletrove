# roletrove

A self-hosted job aggregation engine that crawls company career pages across multiple ATS platforms and exposes a unified search interface.

## what it does

- polls company career pages on a configurable schedule (default: every minute per-company cadence)
- normalises raw job postings into a unified schema (title, seniority, tech stack, location, compensation)
- indexes jobs into Typesense for fast full-text and faceted search
- archives closed jobs daily and stores raw HTML snapshots to Cloudflare R2
- exposes a Next.js web UI and a public REST API (`/api/v1`)

## supported ats platforms

| platform | notes |
|---|---|
| Greenhouse | public board API |
| Ashby | public board API |
| Lever | public postings API |
| Workable | public jobs API + detail endpoint |
| SmartRecruiters | public jobs API |

## stack

| layer | technology |
|---|---|
| monorepo | Turborepo + pnpm workspaces |
| web | Next.js 15, Tailwind CSS |
| worker | Node.js, BullMQ, node-cron |
| database | PostgreSQL 16 + Prisma ORM |
| search | Typesense 27 |
| queue / cache | Redis 7 |
| auth | Better Auth |
| email | Resend |
| blob storage | Cloudflare R2 |
| CDC | Sequin |

## project structure

```
apps/
  web/        → Next.js frontend + API routes
  worker/     → background crawl/normalize/scheduler workers
packages/
  ats-adapters/   → per-platform fetch + normalize logic
  db/             → Prisma schema + client
  search/         → Typesense client, schema, indexer
  shared/         → types, constants, utility functions
```

## getting started

### prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for local services)

### 1. clone and install

```bash
git clone https://github.com/elbetel90/roletrove.git
cd roletrove
pnpm install
```

### 2. configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The required fields for local development are:

- `DATABASE_URL` / `POSTGRES_PASSWORD`
- `REDIS_URL`
- `TYPESENSE_API_KEY`
- `BETTER_AUTH_SECRET`

Everything else (OAuth, R2, Resend, Grafana, OpenAI) is optional and can be left empty to start.

### 3. start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, Typesense, and Sequin.

### 4. set up the database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed        # optional — seeds company list from jobs.json
```

### 5. init typesense

```bash
pnpm --filter @roletrove/search tsx scripts/init-typesense.ts
```

### 6. run

```bash
pnpm dev
```

- web UI: http://localhost:3000
- worker metrics: http://localhost:9090

## api

The public REST API is available under `/api/v1`:

| endpoint | description |
|---|---|
| `GET /api/v1/jobs` | list/search jobs (supports `q`, `company`, `location`, `page`) |
| `GET /api/v1/jobs/:id` | single job detail |
| `GET /api/v1/companies` | list tracked companies |

API key authentication is required — pass `x-api-key: <key>` in the request header.

## license

MIT
