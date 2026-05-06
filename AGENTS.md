# AGENTS.md

## Fast start (verified)
- Use Bun-first commands in this repo.
- Install: `bun install`
- Dev server: `bun run dev` (Vite on port `3000`)
- Tests: `bun run test`
- Lint/format check: `bun run check`
- Build (also refreshes route tree): `bun run build`

## Focused verification
- Run a single test file: `bun run test -- src/lib/imports/import-service.test.ts`
- Run tests by name: `bun run test -- -t "manual classification"`
- No dedicated typecheck script; use `bunx tsc --noEmit` when touching types/contracts.

## App shape that matters
- Single-package TanStack Start app (not a monorepo).
- File-based routes under `src/routes/` contain both UI pages and API handlers (`Route.server.handlers`).
- Core budgeting/import domain logic lives in `src/lib/imports/`.
- DB access patterns are split between:
  - schema/relations: `src/db/schema.ts`
  - repositories: `src/db/repositories/`

## Current domain areas (high-value context)
- CSV import pipeline primitives already exist:
  - parse/normalize rows (`csv-parser`, `transaction-normalizer`)
  - row validation + duplicate detection (`import-row-processor`, `fingerprint`)
  - merchant classification (`merchant-classifier`, `post-import-classifier`)
  - manual override logic (`manual-classification`)
- Transactions UI route exists at `/transactions` with shadcn-based mapper dialog.
- Existing API routes to follow for style/ownership checks:
  - `/api/imports`
  - `/api/transactions/$transactionId/classification`
  - `/api/transactions/review`
  - `/api/envelopes/$envelopeId/allocations`

## Database + env gotchas
- Drizzle is SQLite-based (`drizzle.config.ts`), schema in `src/db/schema.ts`, migrations in `drizzle/`.
- Drizzle CLI env loading order is `.env.local` then `.env`.
- Runtime DB client uses `process.env.DATABASE_URL` directly in `src/db/index.ts`; missing env will crash DB-backed flows.
- DB commands:
  - `bun run db:generate`
  - `bun run db:migrate`
  - `bun run db:push`
  - `bun run db:pull`
  - `bun run db:studio`

## Generated/tooling constraints
- Never manually edit `src/routeTree.gen.ts`.
- Biome excludes `src/routeTree.gen.ts` and `src/styles.css`; do not churn formatting there.
- Canonical alias is `#/...` (see `package.json` imports + `tsconfig.json` paths).

## shadcn usage in this repo
- `components.json` is configured (`new-york`, Radix, alias `#/components/ui`).
- Add UI primitives via: `bunx shadcn@latest add <component>`.
- Prefer existing shadcn components in `src/components/ui/` before custom markup.

## Practical safety
- Do not commit local SQLite artifacts like `dev.db`.
