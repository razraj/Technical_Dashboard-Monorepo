# Backend Timesheet API

API reference for timesheet and entry routes in `apps/backend`. All timesheet endpoints require authentication via the `auth_token` HTTP-only cookie set by `POST /auth/login`.

**Related:** [Postman collection](./postman/Timesheet_APIs.postman_collection.json) · [Data model spec](./superpowers/specs/2026-05-27-replace-scan-with-timesheet-design.md)

## Base URLs

| Environment | URL |
|---|---|
| Backend (direct) | `http://localhost:3000` |
| Via web rewrite (dev) | `http://localhost:3001/api` |

## Authentication

1. `POST /auth/login` with `{ "username": "alice@example.com", "password": "password123" }` (seed user).
2. Backend sets `auth_token` and `refresh_token` cookies on the response.
3. Send cookies on all subsequent requests. `proxy.ts` validates the JWT and injects `x-user-id` for route handlers.

Public routes (no cookie required): `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`.

## Status enum

`TimesheetStatus`: `COMPLETED` | `INCOMPLETE` | `MISSING` (default on create)

## Endpoints

### List timesheets

```
GET /timesheet
```

**Response 200**

```json
{
  "timesheets": [
    {
      "id": "uuid",
      "userId": "uuid",
      "sequenceNumber": 2,
      "status": "INCOMPLETE",
      "title": "Week of 2026-05-19",
      "notes": null,
      "periodStart": "2026-05-19",
      "periodEnd": "2026-05-23",
      "totalHours": 17,
      "regularHours": 16,
      "overtimeHours": 1,
      "submittedAt": null,
      "createdAt": "2026-05-27T12:00:00.000Z",
      "updatedAt": "2026-05-27T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

Ordered by `sequenceNumber` descending.

---

### Create timesheet

```
POST /timesheet
```

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Min length 1 |
| `periodStart` | string | yes | `YYYY-MM-DD` |
| `periodEnd` | string | yes | `YYYY-MM-DD`, must be ≥ `periodStart` |
| `notes` | string | no | |
| `status` | enum | no | Defaults to `MISSING` |

`sequenceNumber` is assigned automatically (`MAX + 1` per user, with retry on unique violation).

**Example**

```json
{
  "title": "Week of 2026-05-26",
  "periodStart": "2026-05-26",
  "periodEnd": "2026-05-30",
  "status": "INCOMPLETE"
}
```

**Response 201** — `{ "timesheet": { ... } }`

---

### Get timesheet (with entries)

```
GET /timesheet/:timesheetId
```

**Response 200** — `{ "timesheet": { ..., "entries": [ ... ] } }`

**Response 404** — timesheet not found or not owned by caller.

---

### Update timesheet

```
PATCH /timesheet/:timesheetId
```

**Body** — at least one field required:

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `notes` | string \| null | |
| `periodStart` | string | `YYYY-MM-DD` |
| `periodEnd` | string | `YYYY-MM-DD` |
| `status` | enum | |
| `submittedAt` | string \| null | ISO 8601 datetime |

**Response 200** — `{ "timesheet": { ... } }`

---

### Delete timesheet

```
DELETE /timesheet/:timesheetId
```

Cascades to all entries. Sequence numbers are not reused.

**Response 200** — `{ "message": "Timesheet deleted" }`

---

### List entries

```
GET /timesheet/:timesheetId/entry
```

**Response 200**

```json
{
  "entries": [
    {
      "id": "uuid",
      "timesheetId": "uuid",
      "workDate": "2026-05-26",
      "hours": 8,
      "startTime": "2026-05-26T09:00:00.000Z",
      "endTime": "2026-05-26T17:00:00.000Z",
      "isOvertime": false,
      "description": "Regular workday",
      "createdAt": "2026-05-27T12:00:00.000Z",
      "updatedAt": "2026-05-27T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### Create entry

```
POST /timesheet/:timesheetId/entry
```

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `workDate` | string | yes | `YYYY-MM-DD` |
| `hours` | number | yes | 0 < hours ≤ 99.99 |
| `startTime` | string | no | ISO 8601 datetime |
| `endTime` | string | no | ISO 8601 datetime |
| `isOvertime` | boolean | no | Default `false` |
| `description` | string | no | |

Roll-ups (`totalHours`, `regularHours`, `overtimeHours`) are recomputed on the parent timesheet in the same transaction.

**Example**

```json
{
  "workDate": "2026-05-26",
  "hours": 8,
  "startTime": "2026-05-26T09:00:00.000Z",
  "endTime": "2026-05-26T17:00:00.000Z",
  "isOvertime": false,
  "description": "Regular workday"
}
```

**Response 201** — `{ "entry": { ... } }`

Multiple entries per day are allowed (split shifts).

---

### Update entry

```
PATCH /timesheet/:timesheetId/entry/:entryId
```

**Body** — at least one field required. Same fields as create; `startTime`, `endTime`, and `description` accept `null` to clear.

Roll-ups are recomputed after update.

**Response 200** — `{ "entry": { ... } }`

---

### Delete entry

```
DELETE /timesheet/:timesheetId/entry/:entryId
```

Roll-ups are recomputed after delete.

**Response 200** — `{ "message": "Entry deleted" }`

---

## Error responses

| Status | When |
|---|---|
| 401 | Missing or invalid auth cookie |
| 403 | Not used for timesheet routes (ownership returns 404) |
| 404 | Timesheet or entry not found / not owned |
| 400 | Validation error — body includes Zod `flatten()` output or a plain `{ "error": "..." }` message |
| 500 | Unexpected server error |

## Roll-up rules

On every entry create, update, or delete:

- `totalHours` = sum of all entry `hours`
- `overtimeHours` = sum of entry `hours` where `isOvertime === true`
- `regularHours` = `totalHours - overtimeHours`

## Seed data for testing

After `pnpm db:seed`:

| User | Email | Password | Timesheets |
|---|---|---|---|
| Alice | `alice@example.com` | `password123` | 2 (seq 1 COMPLETED, seq 2 INCOMPLETE) |
| Bob | `bob@example.com` | `password123` | 2 |
| Carol | `carol@example.com` | `password123` | 0 |
