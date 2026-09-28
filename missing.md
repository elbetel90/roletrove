# Missing / Gap Analysis

Last updated: 2026-09-28

---

## 🔴 High Impact

| Gap | Detail |
|-----|--------|
| **No user accounts** | `User`, `Session`, `SavedSearch` models exist in DB schema but nothing uses them. Better Auth is installed but not wired to any UI. |
| **No job alerts** | `JobAlert` model exists. No email sending, no alert triggers, no notification system. |
| **No public-facing UX** | Current UI is admin-only. No job seeker experience, no "apply" flow, no candidate profile. |
| **Workday support** | Covers Apple, Amazon, Netflix, Google, Microsoft and thousands of Fortune 500 companies. Requires headless browser (Playwright) per company — no public API. |

---

## 🟡 Medium Impact

| Gap | Detail |
|-----|--------|
| **Phase 6 — AI semantic search** | No embeddings generated. No "similar jobs" feature. No candidate-to-role matching. Planned: pgvector or Qdrant for vector store. |
| **No saved searches in UI** | DB schema (`SavedSearch`) exists but no UI component and no API route to create/list/delete them. |
| **No public API** | `ApiKey` model is in schema. No REST routes exposed. No B2B layer. |
| **Typesense stale for SmartRecruiters jobs** | New SR companies were added in Phase 7. Jobs are hitting Postgres via the worker but Typesense has not been re-indexed since SR was added. Run `packages/search/scripts/reindex.ts` to fix. |
| **Workable jobs missing descriptions (backfill needed)** | Companies that existed in the DB before Phase 7 (description enrichment) have empty `description_text`. Need a one-off script to re-crawl them with the new detail endpoint. |

---

## 🟢 Polish / Nice-to-Have

| Gap | Detail |
|-----|--------|
| **Production deployment** | Everything runs locally. No cloud infra (Railway, Fly.io, Render, etc.), no CI/CD pipeline. |
| **No monitoring or alerting** | No Sentry, no uptime checks, no error rate alerts. Metrics server runs on :9090 but nothing reads it. |
| **Zero test coverage** | No unit tests, no integration tests, no E2E tests. |
| **Sequin CDC broken** | `sequin` container keeps restarting. Typesense syncs fall back to direct writes in the normalize worker — works but suboptimal. |
| **Teamtailor / Personio** | Both require API keys — no public endpoint. Covers Spotify, Klarna, and many EU companies. |
| **More SmartRecruiters companies** | Zalando, Klarna, BMW, SAP slugs not confirmed yet. Need slug discovery pass specific to SR naming conventions. |

---

## Recommended Order of Attack

1. **Re-index Typesense** — 10 min, makes all SR jobs searchable immediately
2. **Workable description backfill** — one-off script to fill empty `description_text` for existing Workable companies
3. **User auth + saved searches** — Better Auth already installed, needs UI wiring and email integration
4. **Phase 6 — AI semantic matching** — embeddings, similarity search, "jobs like this one"
5. **Workday scraper** — Playwright-based, highest coverage unlock (FAANG + Fortune 500)
6. **Production deployment** — Docker Compose → cloud (Railway / Fly.io recommended)
