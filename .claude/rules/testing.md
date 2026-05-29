# Testing Guidelines

## Overview

Guidelines for writing and running tests in the monorepo. Backend API tests are the primary target (vitest).

## Current State

- **No test harness configured** — `apps/backend` has no `test` script or vitest config.
- **`yarn test`** runs turbo but executes zero tasks until packages define `test` scripts.
- **Web E2E:** Playwright in `apps/web/e2e/` — `yarn workspace web test:e2e` (uses `E2E_EMAIL` / `E2E_PASSWORD` or seed defaults).

## Intended Backend Test Structure

When tests are added, follow this layout:

```text
apps/backend/__tests__/
  api/          # one test file per route (auth, user, timesheets, etc.)
  fixtures/     # shared test fixtures
  helpers/      # prisma-mock.ts — mock Prisma in all tests (no real DB needed)
  lib/
```

## Commands (when configured)

- **Run all tests**: `yarn workspace backend test`
- **Watch mode**: `yarn workspace backend test:watch`
- **Single file**: `yarn workspace backend test __tests__/api/auth.test.ts`

## Conventions

- Mock `@repo/db` via a shared helper — do not hit a real database in unit/integration tests.
- One test file per route module under `apps/backend/app/`.
