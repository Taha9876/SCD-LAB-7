# Lab 7 — Student Course Management System

A Node.js (Express) REST API that lets students manage their enrolled courses, track
assignments and monitor their academic progress. Each student has their own account and
only ever sees their own data. Tests run automatically on GitHub Actions.

## Features

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Course management (add, update, delete, view) | [src/routes/courses.js](src/routes/courses.js) |
| 2 | Assignment management (title, description, due date, submission status) | [src/routes/courses.js](src/routes/courses.js), [src/routes/assignments.js](src/routes/assignments.js) |
| 3 | Progress tracking (per course and overall) | [src/utils/progress.js](src/utils/progress.js), [src/routes/progress.js](src/routes/progress.js) |
| 4 | Course filtering (code, instructor, completion status) | `GET /api/courses` in [src/routes/courses.js](src/routes/courses.js) |
| 5 | User authentication (register, login, JWT) | [src/routes/auth.js](src/routes/auth.js), [src/middleware/auth.js](src/middleware/auth.js) |
| 6 | Automated testing with GitHub Actions | [.github/workflows/ci.yml](.github/workflows/ci.yml), [tests/](tests/) |

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm start        # http://localhost:3000
npm test         # run the automated tests
```

Data is saved to `data/db.json` (created on first write), so it survives restarts.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Port the server listens on |
| `JWT_SECRET` | a development-only value | Secret used to sign login tokens — set your own outside the lab |
| `JWT_EXPIRES_IN` | `2h` | How long a login token stays valid |
| `DB_FILE` | `data/db.json` | Where the data is stored |

## API

Every route except register and login needs the header `Authorization: Bearer <token>`.

### Authentication

| Method | Route | Body | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/register` | `name`, `email`, `password` (6+ characters) | Returns `user` and `token` |
| POST | `/api/auth/login` | `email`, `password` | Returns `user` and `token` |
| GET | `/api/auth/me` | — | The logged-in student |

### Courses

| Method | Route | Body | Notes |
|--------|-------|------|-------|
| GET | `/api/courses` | — | Filters: `?code=`, `?instructor=`, `?status=` |
| POST | `/api/courses` | `name`, `code`, `instructor`, `creditHours` | Course code must be unique per student |
| GET | `/api/courses/:id` | — | |
| PUT | `/api/courses/:id` | any of the course fields | Only the fields sent are changed |
| DELETE | `/api/courses/:id` | — | Also deletes the course's assignments |
| GET | `/api/courses/:id/progress` | — | Completion summary for one course |

Filters can be combined. `code` and `instructor` match any part of the value and ignore
case (`?code=cs` finds `CS-301` and `CS-220`). `status` is one of `not-started`,
`in-progress` or `completed`.

### Assignments

| Method | Route | Body | Notes |
|--------|-------|------|-------|
| POST | `/api/courses/:id/assignments` | `title`, `dueDate`, optional `description`, `status` | Status defaults to `pending` |
| GET | `/api/courses/:id/assignments` | — | Assignments of one course |
| GET | `/api/assignments` | — | All assignments, soonest due first. Filters: `?status=pending\|submitted\|overdue`, `?courseId=` |
| GET | `/api/assignments/:id` | — | |
| PUT | `/api/assignments/:id` | any of the assignment fields | Send `{"status": "submitted"}` to mark it done |
| DELETE | `/api/assignments/:id` | — | |

### Progress

| Method | Route | Notes |
|--------|-------|-------|
| GET | `/api/progress` | Overall totals (courses, credit hours, assignments, percent complete) plus a per-course breakdown |

A course's completion status comes from its assignments:

- `not-started` — nothing submitted yet (including a course with no assignments)
- `in-progress` — some, but not all, assignments submitted
- `completed` — every assignment submitted

An assignment is overdue when it is still pending and its due date has passed.

## Example

```bash
# Register and keep the token from the response
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali Khan","email":"ali@example.com","password":"secret123"}'

TOKEN=<token from the response>

# Add a course
curl -X POST http://localhost:3000/api/courses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Software Construction","code":"CS-301","instructor":"Dr. Ahmed","creditHours":3}'

# Add an assignment to it
curl -X POST http://localhost:3000/api/courses/<courseId>/assignments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Lab 7","description":"CI with GitHub Actions","dueDate":"2026-12-01"}'

# Mark it submitted, then check progress
curl -X PUT http://localhost:3000/api/assignments/<assignmentId> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"submitted"}'

curl http://localhost:3000/api/progress -H "Authorization: Bearer $TOKEN"

# Filter courses
curl "http://localhost:3000/api/courses?instructor=ahmed&status=completed" \
  -H "Authorization: Bearer $TOKEN"
```

## Tests

`npm test` runs 50 Jest + Supertest tests against the real Express app, each suite on a
fresh in-memory store:

| File | Covers |
|------|--------|
| [tests/auth.test.js](tests/auth.test.js) | Register, login, password hashing, protected routes |
| [tests/courses.test.js](tests/courses.test.js) | Course CRUD, validation, filtering, isolation between students |
| [tests/assignments.test.js](tests/assignments.test.js) | Assignment CRUD, status changes, overdue filter, isolation |
| [tests/progress.test.js](tests/progress.test.js) | Per-course and overall progress calculation |
| [tests/store.test.js](tests/store.test.js) | Saving to and reloading from disk |

## Continuous integration

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push to `main` and on
every pull request targeting `main`. It checks out the code, installs dependencies with
`npm ci` and runs `npm test`, on Node.js 20 and 22.

The workflow expects this folder to be the root of the GitHub repository:

```bash
git init -b main
git add .
git commit -m "Lab 7: student course management system"
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

To see the pull-request trigger, push a branch and open a PR into `main`:

```bash
git checkout -b feature/demo
git commit --allow-empty -m "Trigger CI"
git push -u origin feature/demo
```

## Project structure

```
src/
  server.js            starts the HTTP server
  app.js               builds the Express app
  config.js            environment settings
  store.js             JSON-file data store
  validators.js        request body validation
  middleware/auth.js   JWT check for protected routes
  routes/              auth, courses, assignments, progress
  utils/progress.js    completion calculations
tests/                 Jest + Supertest suites
.github/workflows/     GitHub Actions workflow
```
