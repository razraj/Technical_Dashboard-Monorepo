# Replace `Scan` with `Timesheet` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Scan` domain in `@repo/db` with a `Timesheet` + `TimesheetEntry` domain that supports per-user sequential numbering, three-state status (`COMPLETED`/`INCOMPLETE`/`MISSING`), and first-class working-hours management.

**Architecture:** A `Timesheet` model owned by `User` carries metadata (status, period, roll-up totals) and a per-user `sequenceNumber` enforced by a composite unique constraint. Per-day work is stored in `TimesheetEntry` rows with optional clock-in/out, an overtime flag, and a date. Roll-ups on the parent are denormalized and will be recomputed inside future backend transactions whenever entries change.

**Tech Stack:** Prisma 7, PostgreSQL, pnpm + Turborepo, `tsx` for the seed script.

**Spec:** `docs/superpowers/specs/2026-05-27-replace-scan-with-timesheet-design.md`

**Note on TDD:** This change is a data-model + seed update with no consuming backend route yet. There is no behavior to drive with unit tests. Verification at each step is: (a) Prisma generates the client without error, (b) the migration applies, (c) the seed runs and produces the expected rows. When the future `POST /timesheet` route is built, TDD will apply there — that's out of scope for this plan.

**Prerequisites before starting:**
- `docker compose up -d` (or whatever brings up the local Postgres declared in `docker-compose.yml`).
- `.env` is set with a valid `DATABASE_URL`.
- `pnpm install` has been run at least once.
- You are on a clean branch (no uncommitted DB changes).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/db/src/prisma/schema.prisma` | Modify | Drop `Scan` model + `ScanType` enum; add `TimesheetStatus` enum, `Timesheet` model, `TimesheetEntry` model; replace `User.scans` with `User.timesheets`. |
| `packages/db/src/prisma/migrations/<timestamp>_replace_scan_with_timesheet/migration.sql` | Create (via `prisma migrate dev`) | SQL to drop `Scan`/`ScanType`, create enum + tables + indexes + FKs. |
| `packages/db/src/seed.ts` | Modify | Remove `ScanType` import and Scan creation; add Timesheet + TimesheetEntry creation for Alice and Bob; update activity-log entry. |
| `README.md` | Modify | Update `apps/backend` row description: drop "scan", mention "timesheets". |

No new top-level files. No backend route handlers in this plan.

---

## Task 1: Replace `Scan` model with `Timesheet` + `TimesheetEntry` in the Prisma schema

**Files:**
- Modify: `packages/db/src/prisma/schema.prisma`

- [ ] **Step 1: Open the schema and replace the `ScanType` enum, `Scan` model, and the `scans` relation on `User`**

Open `packages/db/src/prisma/schema.prisma`. The current relevant portions look like this:

```prisma
enum ScanType {
  IMAGE
  TEXT_NAME
  TEXT_NAMES
}

model User {
  // ... (id, email, password, username, firstName, lastName, profilePic, refreshToken, refreshTokenExp, resetToken, resetTokenExp, isDeleted, createdAt, updatedAt) ...
  ActivityLog ActivityLog[] @relation("UserActivityLogs")
  scans       Scan[]

  @@index([isDeleted])
}

model Scan {
  id                       String   @id @default(uuid())
  userId                   String
  detectedSubstances       String[]
  detectedBannedSubstances Json
  isSafe                   Boolean
  scanType                 ScanType

  scannedAt DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, scannedAt])
}
```

Make the following edits:

1. **Delete** the `enum ScanType { ... }` block entirely.
2. **Delete** the `model Scan { ... }` block entirely.
3. In `model User`, change `scans Scan[]` to `timesheets Timesheet[]`.
4. **Add** the new enum and two new models below `model User` (and above `model ActivityLog` so the file stays grouped logically):

```prisma
enum TimesheetStatus {
  COMPLETED
  INCOMPLETE
  MISSING
}

model Timesheet {
  id             String          @id @default(uuid())
  userId         String
  sequenceNumber Int
  status         TimesheetStatus @default(MISSING)

  title       String
  notes       String?
  periodStart DateTime @db.Date
  periodEnd   DateTime @db.Date

  totalHours    Decimal @default(0) @db.Decimal(6, 2)
  regularHours  Decimal @default(0) @db.Decimal(6, 2)
  overtimeHours Decimal @default(0) @db.Decimal(6, 2)

  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user    User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries TimesheetEntry[]

  @@unique([userId, sequenceNumber])
  @@index([userId])
  @@index([userId, createdAt])
}

model TimesheetEntry {
  id          String    @id @default(uuid())
  timesheetId String
  workDate    DateTime  @db.Date
  hours       Decimal   @db.Decimal(4, 2)
  startTime   DateTime?
  endTime     DateTime?
  isOvertime  Boolean   @default(false)
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheetId], references: [id], onDelete: Cascade)

  @@index([timesheetId])
  @@index([timesheetId, workDate])
}
```

- [ ] **Step 2: Format the schema with Prisma's formatter**

Run:

```bash
pnpm -F @repo/db exec prisma format
```

Expected output: `Formatted ./src/prisma/schema.prisma in <N>ms`.

- [ ] **Step 3: Generate the Prisma client against the new schema**

Run:

```bash
pnpm db:generate
```

Expected:
- Turbo runs `prisma generate` inside `@repo/db`.
- Output contains `Generated Prisma Client (v7.x) to ./src/generated/client`.
- No reference to `Scan` or `ScanType` in the printed model list.

If generate fails with a schema error, read the error, fix the schema, re-run.

- [ ] **Step 4: Commit the schema change (migration is in the next task)**

```bash
git add packages/db/src/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(db): replace Scan model with Timesheet + TimesheetEntry

Drops ScanType enum and Scan model. Adds TimesheetStatus enum,
Timesheet (per-user sequenceNumber, status, period, roll-up hours),
and TimesheetEntry (per-day hours, clock-in/out, overtime flag).
Migration follows in next commit.
EOF
)"
```

---

## Task 2: Generate the database migration

**Files:**
- Create: `packages/db/src/prisma/migrations/<timestamp>_replace_scan_with_timesheet/migration.sql`

- [ ] **Step 1: Run `prisma migrate dev` to create and apply the migration**

(Note: we call Prisma directly here instead of `pnpm db:migrate` because the root turbo task does not forward `--name` to the underlying CLI.)

```bash
pnpm -F @repo/db exec prisma migrate dev --name replace_scan_with_timesheet
```

This will:
1. Compare the current DB to the new schema.
2. Generate a new migration directory under `packages/db/src/prisma/migrations/` named `<timestamp>_replace_scan_with_timesheet`.
3. Apply the migration to the local DB.
4. Regenerate the Prisma client.

Prisma will print a warning that the `Scan` table will be dropped and ask for confirmation since it contains data. If your local DB has Scan rows, type `y` to confirm — the spec accepts this destructive change.

- [ ] **Step 2: Verify the migration SQL was generated correctly**

Open the newly created `packages/db/src/prisma/migrations/<timestamp>_replace_scan_with_timesheet/migration.sql` and confirm it contains, in order:

1. `ALTER TABLE "Scan" DROP CONSTRAINT "Scan_userId_fkey";` (or equivalent)
2. `DROP TABLE "Scan";`
3. `DROP TYPE "ScanType";`
4. `CREATE TYPE "TimesheetStatus" AS ENUM ('COMPLETED', 'INCOMPLETE', 'MISSING');`
5. `CREATE TABLE "Timesheet" (...)` with columns matching the Prisma model, including `"periodStart" DATE NOT NULL`, `"totalHours" DECIMAL(6,2) NOT NULL DEFAULT 0`, etc.
6. `CREATE TABLE "TimesheetEntry" (...)` with `"workDate" DATE NOT NULL`, `"hours" DECIMAL(4,2) NOT NULL`, etc.
7. `CREATE UNIQUE INDEX "Timesheet_userId_sequenceNumber_key" ON "Timesheet"("userId", "sequenceNumber");`
8. `CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");`
9. `CREATE INDEX "Timesheet_userId_createdAt_idx" ON "Timesheet"("userId", "createdAt");`
10. `CREATE INDEX "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");`
11. `CREATE INDEX "TimesheetEntry_timesheetId_workDate_idx" ON "TimesheetEntry"("timesheetId", "workDate");`
12. `ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
13. `ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;`

If any of these are missing or differ in a non-cosmetic way, the schema was wrong — go back to Task 1 and fix.

- [ ] **Step 3: Verify the DB state**

```bash
pnpm -F @repo/db exec prisma db pull --print | head -100
```

Expected: the printed schema reflects the new tables. No `Scan` or `ScanType` appears.

- [ ] **Step 4: Commit the migration**

```bash
git add packages/db/src/prisma/migrations/
git commit -m "$(cat <<'EOF'
feat(db): migration to drop Scan and create Timesheet, TimesheetEntry

Destructive: drops Scan table and ScanType enum (no consumers).
Creates TimesheetStatus enum and the two new tables with indexes,
unique constraint on (userId, sequenceNumber), and cascade FKs.
EOF
)"
```

---

## Task 3: Update the seed script

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Replace the seed file contents**

The current file imports `ScanType` and creates Scan rows. Replace the entire file with the version below. This:
- Drops the `ScanType` import.
- Adds helper functions to compute the Monday of N weeks ago and the Friday of that same week.
- Creates 2 timesheets each for Alice and Bob (sequenceNumber 1 and 2).
- Leaves Carol with no timesheets (represents the "no row yet" state, distinct from `status: MISSING`).
- Updates the activity-log seed entry `type: "SCAN"` → `type: "TIMESHEET"`.

Full new contents of `packages/db/src/seed.ts`:

```typescript
/* eslint-disable */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma, TimesheetStatus } from "./index.js";

const DEFAULT_PASSWORD = "password123";

const usersToCreate = [
    {
        email: "alice@example.com",
        username: "alice",
        firstName: "Alice",
        lastName: "Smith",
        password: DEFAULT_PASSWORD
    },
    {
        email: "bob@example.com",
        username: "bob",
        firstName: "Bob",
        lastName: "Jones",
        password: DEFAULT_PASSWORD
    },
    {
        email: "carol@example.com",
        username: "carol",
        firstName: "Carol",
        lastName: "Williams",
        password: DEFAULT_PASSWORD
    }
];

function startOfDayUTC(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
}

function mondayOfWeeksAgo(weeksAgo: number): Date {
    const now = startOfDayUTC(new Date());
    const dayOfWeek = now.getUTCDay();
    const offsetToMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - offsetToMonday);
    const target = new Date(thisMonday);
    target.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7);
    return target;
}

function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() + days);
    return out;
}

function atUTC(d: Date, hours: number, minutes: number): Date {
    const out = new Date(d);
    out.setUTCHours(hours, minutes, 0, 0);
    return out;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function seedTimesheetsForUser(userId: string, username: string): Promise<void> {
    const twoWeeksAgoMonday = mondayOfWeeksAgo(2);
    const twoWeeksAgoFriday = addDays(twoWeeksAgoMonday, 4);

    const completed = await prisma.timesheet.create({
        data: {
            userId,
            sequenceNumber: 1,
            status: TimesheetStatus.COMPLETED,
            title: `Week of ${isoDate(twoWeeksAgoMonday)}`,
            notes: null,
            periodStart: twoWeeksAgoMonday,
            periodEnd: twoWeeksAgoFriday,
            totalHours: 40,
            regularHours: 40,
            overtimeHours: 0,
            submittedAt: atUTC(twoWeeksAgoFriday, 17, 0)
        }
    });

    await prisma.timesheetEntry.createMany({
        data: [0, 1, 2, 3, 4].map((dayOffset) => ({
            timesheetId: completed.id,
            workDate: addDays(twoWeeksAgoMonday, dayOffset),
            hours: 8,
            startTime: atUTC(addDays(twoWeeksAgoMonday, dayOffset), 9, 0),
            endTime: atUTC(addDays(twoWeeksAgoMonday, dayOffset), 17, 0),
            isOvertime: false,
            description: "Regular workday"
        }))
    });

    const lastWeekMonday = mondayOfWeeksAgo(1);
    const lastWeekFriday = addDays(lastWeekMonday, 4);
    const lastWeekTuesday = addDays(lastWeekMonday, 1);

    const incomplete = await prisma.timesheet.create({
        data: {
            userId,
            sequenceNumber: 2,
            status: TimesheetStatus.INCOMPLETE,
            title: `Week of ${isoDate(lastWeekMonday)}`,
            notes: "Still need to fill in Wed-Fri",
            periodStart: lastWeekMonday,
            periodEnd: lastWeekFriday,
            totalHours: 17,
            regularHours: 16,
            overtimeHours: 1,
            submittedAt: null
        }
    });

    await prisma.timesheetEntry.createMany({
        data: [
            {
                timesheetId: incomplete.id,
                workDate: lastWeekMonday,
                hours: 8,
                startTime: atUTC(lastWeekMonday, 9, 0),
                endTime: atUTC(lastWeekMonday, 17, 0),
                isOvertime: false,
                description: "Regular workday"
            },
            {
                timesheetId: incomplete.id,
                workDate: lastWeekTuesday,
                hours: 8,
                startTime: atUTC(lastWeekTuesday, 9, 0),
                endTime: atUTC(lastWeekTuesday, 17, 0),
                isOvertime: false,
                description: "Regular workday"
            },
            {
                timesheetId: incomplete.id,
                workDate: lastWeekTuesday,
                hours: 1,
                startTime: atUTC(lastWeekTuesday, 17, 0),
                endTime: atUTC(lastWeekTuesday, 18, 0),
                isOvertime: true,
                description: "Late ticket fix"
            }
        ]
    });

    console.log(`Created 2 timesheets (5 + 3 entries) for ${username}`);
}

async function main() {
    console.log("Seeding database...");

    const createdUsers: { id: string; username: string; email: string; password: string }[] = [];
    for (const u of usersToCreate) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.create({
            data: {
                email: u.email,
                username: u.username,
                firstName: u.firstName,
                lastName: u.lastName,
                password: hashedPassword
            }
        });
        createdUsers.push({ id: user.id, username: u.username, email: u.email, password: u.password });
        console.log(`Created user: ${u.username} (${u.email})`);
    }

    if (createdUsers[0]) {
        await prisma.activityLog.createMany({
            data: [
                { userId: createdUsers[0].id, type: "LOGIN", description: "User logged in" },
                { userId: createdUsers[0].id, type: "TIMESHEET", description: "Submitted weekly timesheet" },
                { userId: createdUsers[0].id, type: "PROFILE_UPDATE", description: "Updated profile" }
            ]
        });
        console.log("Created activity logs for", createdUsers[0].username);
    }

    for (let i = 0; i < Math.min(2, createdUsers.length); i++) {
        const user = createdUsers[i];
        if (!user) continue;
        await seedTimesheetsForUser(user.id, user.username);
    }

    console.log("\n############# Login details #############");
    createdUsers.forEach((u) => {
        console.log(`  username: ${u.username}  |  email: ${u.email}  |  password: ${u.password}`);
    });
    console.log("########################################\n");
    console.log("Seed completed.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
```

- [ ] **Step 2: Reset and reseed the local DB to verify**

(Note: the root `pnpm db:reset` script points at a `db:reset` script that does not exist in `@repo/db`. Call Prisma directly instead.)

```bash
pnpm -F @repo/db exec prisma migrate reset
```

When prompted, confirm the reset. `prisma migrate reset` will:
1. Drop the DB.
2. Re-create it.
3. Re-apply all migrations (including the new one from Task 2).
4. Run the seed script.

Expected console output ends with:

```
Created user: alice (alice@example.com)
Created user: bob (bob@example.com)
Created user: carol (carol@example.com)
Created activity logs for alice
Created 2 timesheets (5 + 3 entries) for alice
Created 2 timesheets (5 + 3 entries) for bob

############# Login details #############
  username: alice  |  email: alice@example.com  |  password: password123
  username: bob    |  email: bob@example.com    |  password: password123
  username: carol  |  email: carol@example.com  |  password: password123
########################################

Seed completed.
```

If the seed errors, read the error (most likely a type mismatch on Decimal — the values `8`, `40`, `0`, etc., are accepted by Prisma's Decimal input; if not, wrap them as strings: `"8"`, `"40"`, `"0"`).

- [ ] **Step 3: Spot-check the seeded data**

```bash
pnpm -F @repo/db exec prisma studio
```

Open `http://localhost:5555`, then verify:
- `User` table: 3 rows.
- `Timesheet` table: 4 rows (2 for alice, 2 for bob; sequenceNumber 1 and 2 for each).
- `TimesheetEntry` table: 16 rows total (5 + 3 = 8 per user × 2 users).
- Alice's sequenceNumber=1 timesheet has `totalHours=40`, `regularHours=40`, `overtimeHours=0`, status `COMPLETED`.
- Alice's sequenceNumber=2 timesheet has `totalHours=17`, `regularHours=16`, `overtimeHours=1`, status `INCOMPLETE`.
- Carol's user row exists but has zero timesheets.

Close Studio when done.

- [ ] **Step 4: Lint the package**

```bash
pnpm -F @repo/db lint
```

Expected: passes with no warnings (note the seed has `/* eslint-disable */` at the top, matching the original).

- [ ] **Step 5: Commit the seed change**

```bash
git add packages/db/src/seed.ts
git commit -m "$(cat <<'EOF'
feat(db): seed timesheets and entries for Alice and Bob

- Removes Scan seeding and ScanType import.
- Creates 2 timesheets per seeded user (COMPLETED + INCOMPLETE)
  with 5 and 3 entries respectively, demonstrating the overtime
  flag and split entries on the same day.
- Updates the SCAN activity log entry to TIMESHEET.
EOF
)"
```

---

## Task 4: Update the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Edit the apps/backend description**

In `README.md`, find this line in the Apps & Packages table:

```
| `apps/backend` | 3000 | API-only Next.js app. Auth, scan, files, history, AI, queues, webhooks. |
```

Replace it with:

```
| `apps/backend` | 3000 | API-only Next.js app. Auth, timesheets, files, history, AI, queues, webhooks. |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update backend description (scan -> timesheets)"
```

---

## Task 5: Final verification

**Files:** none modified.

- [ ] **Step 1: Run the full lint suite**

```bash
pnpm lint
```

Expected: all packages lint clean. If any package errors, read the error and fix.

- [ ] **Step 2: Run the full build**

```bash
pnpm build
```

Expected: all packages build successfully. The web app may show no Timesheet usage (correct — no UI in scope). The backend builds without referencing Scan (it never did).

- [ ] **Step 3: Run the backend tests**

```bash
pnpm -F backend test
```

Expected: existing auth/user tests pass. There are no Timesheet tests yet (none in scope for this plan).

- [ ] **Step 4: Confirm acceptance criteria from the spec**

Walk through each item in the spec's "Acceptance criteria" section and tick them off:

1. `pnpm db:generate` succeeds against the new schema — verified in Task 1.
2. `pnpm db:migrate` applies cleanly on a fresh DB — verified in Task 2.
3. `pnpm db:seed` runs without errors and produces the expected rows — verified in Task 3.
4. `Scan` and `ScanType` are gone from the generated Prisma client — confirm by ripgrep:

   ```bash
   rg -n 'ScanType|model Scan' packages/db/src/prisma/schema.prisma packages/db/src/seed.ts
   ```

   Expected: no matches.
5. `pnpm lint` and `pnpm build` pass — verified in Steps 1 and 2 of this task.

- [ ] **Step 5: No commit needed for this task**

Verification only. If anything fails, return to the relevant task, fix, and re-run.

---

## Out of Scope (do NOT add to this plan)

- Backend `POST /timesheet`, `GET /timesheet`, `PATCH /timesheet/:id`, entry CRUD routes.
- Web UI for creating/viewing timesheets.
- Roll-up recomputation helpers in backend code.
- Tests for Timesheet behavior.

These belong in a follow-up spec + plan once the data model is landed.
