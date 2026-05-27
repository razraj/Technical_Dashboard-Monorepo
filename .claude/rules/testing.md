# Testing Guidelines

## Overview

Guidelines for writing and running tests in the monorepo. Backend API tests are the primary target (vitest).

## Current State

- **No test harness configured** — `apps/backend` has no `test` script or vitest config.
- **`pnpm test`** runs turbo but executes zero tasks until packages define `test` scripts.

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

- **Run all tests**: `pnpm -F backend test`
- **Watch mode**: `pnpm -F backend test:watch`
- **Single file**: `pnpm -F backend test __tests__/api/auth.test.ts`

## Conventions

- Mock `@repo/db` via a shared helper — do not hit a real database in unit/integration tests.
- One test file per route module under `apps/backend/app/`.
