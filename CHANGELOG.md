# Changelog

All notable changes are documented here. This project is pre-1.0; treat the API and schema as unstable until a later 1.x release.

## Unreleased

- Session-gated crawl monitor, `/api/crawl-logs`, and `/api/stats`
- Worker metrics bound to localhost by default
- Jobs identified by ATS source id; `exact_hash` is no longer unique
- Compensation values that do not fit Postgres INT4 are stored as null
- CI typecheck/lint plus unit and upsert tests
- Dependabot for npm and GitHub Actions

## 0.1.0

Initial public-ready snapshot: MIT license, contributing docs, Docker Compose volumes, Prisma migrations, and a documented local setup.
