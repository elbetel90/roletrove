# Contributing

Thanks for helping improve RoleTrove. This repo is a pnpm + Turborepo monorepo.

## development setup

Follow the [README getting started](./README.md#getting-started) steps: install, copy `.env.example` to `.env`, start Docker services, apply migrations, optionally seed, init Typesense, then `pnpm dev`.

## scripts

| command | what it does |
|---|---|
| `pnpm dev` | run web + worker |
| `pnpm typecheck` | TypeScript across packages that define it |
| `pnpm lint` | Next.js lint for `apps/web` |
| `pnpm test` | unit tests plus worker upsert tests when `DATABASE_URL` is set |
| `pnpm db:generate` | generate the Prisma client |
| `pnpm db:migrate:deploy` | apply committed migrations |
| `pnpm db:migrate` | create a new migration (`prisma migrate dev`) |
| `pnpm db:seed` | upsert the built-in company list |

## pull requests

- Keep PRs focused on one change.
- Do not commit `.env`, secrets, or local data dumps.
- Schema changes need a Prisma migration under `packages/db/prisma/migrations/`.
- Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` before you open the PR.
- Add a line to [CHANGELOG.md](./CHANGELOG.md) under **Unreleased** when the change is user-visible.
- New ATS adapters belong in `packages/ats-adapters` with the same fetch + normalize split as the existing platforms.

## reporting issues

Use the GitHub issue templates. For security reports, see [SECURITY.md](./SECURITY.md).
