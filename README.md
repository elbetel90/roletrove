# roletrove

A self-hosted job aggregation engine that crawls company career pages across multiple ATS platforms and exposes a unified search interface.

## what it does

- polls due companies every minute; each company has its own cadence (`poll_interval_hours`, default **4**)
- normalises raw job postings into a unified schema (title, seniority, tech stack, location, compensation)
- indexes jobs into Typesense for fast full-text and faceted search
- archives closed jobs daily and stores raw HTML snapshots to Cloudflare R2
- exposes a Next.js web UI and a REST API (`/api/v1`)

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
| web | Next.js 14, Tailwind CSS |
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

`NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` default to `http://localhost:3000` if unset. Everything else (OAuth, R2, Resend, Grafana, OpenAI) is optional and can be left empty to start.

### 3. start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, Typesense, and Sequin. Compose creates named volumes on first run.

### 4. set up the database

```bash
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed        # optional — upserts the built-in company list
```

If this database was created earlier with `db:push`, mark the initial migration as already applied instead of re-running it:

```bash
pnpm --filter @roletrove/db exec prisma migrate resolve --applied 0_init
```

Seed inserts companies (who to crawl), not job postings. Jobs are fetched from each company's public ATS API when the worker runs.

### 5. init typesense

```bash
pnpm --filter @roletrove/search tsx scripts/init-typesense.ts
```

### 6. run

```bash
pnpm dev
```

- web UI: http://localhost:3000
- worker metrics: http://localhost:9090 (no auth — bind locally only)

## api

The REST API is available under `/api/v1`:

| endpoint | description |
|---|---|
| `GET /api/v1/jobs` | list/search jobs (supports `q`, `company_slug`, `location_type`, `page`, …) |
| `GET /api/v1/jobs/:id` | single job detail |
| `GET /api/v1/companies` | list tracked companies |

Authentication: `Authorization: Bearer <api_key>`.

Keys are stored as SHA-256 hashes in the `ApiKey` table. There is no minting UI yet — create a user, hash a random key, and insert the row:

```bash
node -e "const {createHash,randomBytes}=require('crypto'); const raw='rt_'+randomBytes(24).toString('hex'); console.log('key:', raw); console.log('hash:', createHash('sha256').update(raw).digest('hex'))"
```

Insert `hash` into `ApiKey.key_hash` with a valid `user_id`, then send `key` as the Bearer token.

## responsible use

Default seed data points at ~90 real public career boards. The worker will call those ATS APIs once it starts. Keep the default poll interval, do not run `scripts/discover-companies.ts` unless you intend to probe many company slugs, and review each ATS provider's terms before crawling at scale.

## contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Please read the [code of conduct](./CODE_OF_CONDUCT.md) and [security policy](./SECURITY.md).

## license

[MIT](./LICENSE)
