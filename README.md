# BuildTrack

A construction progress and payment transparency portal for people who have bought a flat that is still being built.

- **Buyers** see how far their building has got, with photos from the site. They also see what they have paid, what is due next and when, and the expected handover date with every change and its reason. They can ask an AI assistant about their flat.
- **Site engineers** post photo updates from their phone. AI suggests which stage the photos show and how far along it looks.
- **Managers** review updates before buyers see them, record payments and issue receipts, change handover dates with a reason, and see which projects are at risk of delay.

Pilot developer in the demo data: **Pipra Estate**, Dhaka.

Built for the *Advanced Web Technology* course (AIUB, Fall 2026-27) by MIR MD. BOKTIAR PARVEZ (23-55358-3) and MD ABIR AHMED (23-55385-3).

| Part | Technology |
|---|---|
| Web app | Next.js 15 (App Router), React 19, Tailwind CSS 4, TanStack Query |
| API | NestJS 11, TypeORM, class-validator, Swagger |
| Database | PostgreSQL 16 (pgvector optional) |
| AI | Google Gemini API (`gemini-2.5-flash`, `gemini-embedding-001`), with a built-in offline mode |

---

## 1. Run it on your computer

### What you need

1. **Node.js 20.11 or newer**: <https://nodejs.org> (choose the LTS version).
2. **pnpm**: after installing Node, open a terminal and run `corepack enable`. On Windows, run it in a terminal opened *as Administrator*. If that fails, use `npm install -g pnpm` instead.
3. **PostgreSQL**. Choose one:
   - **Option A, Docker (easiest).** Install Docker Desktop, then run `docker compose up -d` in the project folder. This starts PostgreSQL with pgvector and creates both databases.
   - **Option B, install PostgreSQL directly.** Use the installer from <https://www.postgresql.org/download/> (version 14 or newer). Then open *SQL Shell (psql)* or a terminal and run:
     ```sql
     CREATE USER buildtrack WITH PASSWORD 'buildtrack';
     CREATE DATABASE buildtrack OWNER buildtrack;
     CREATE DATABASE buildtrack_test OWNER buildtrack;
     ```
     pgvector is optional. Without it, document search runs in the app instead of the database. It works the same, just slower for very large document sets.

### First-time setup

```bash
# 1. Copy the example settings files
cp apps/api/.env.example apps/api/.env          # Windows: copy apps\api\.env.example apps\api\.env
cp apps/web/.env.example apps/web/.env.local    # Windows: copy apps\web\.env.example apps\web\.env.local

# 2. Install packages, create the tables and load the demo data
pnpm bootstrap

# 3. Start the API (port 4000) and the web app (port 3000) together
pnpm dev
```

Open **<http://localhost:3000>**. The API documentation (Swagger) is at <http://localhost:4000/api/docs>.

> Always use `localhost:3000` exactly. The API rejects form submissions from any other address (this protects against cross-site attacks), so a different port or `127.0.0.1` will give a "403" on login.

### Demo accounts

All demo accounts use the password **`Demo@12345`**. The login page lists them too.

| Who | Email | Opens at |
|---|---|---|
| Admin | `admin@pipra.test` | `/admin` |
| Project manager | `manager@pipra.test` | `/admin` |
| Site engineer | `engineer@pipra.test` | `/site` (best on a phone-sized window) |
| Buyer (on time) | `buyer1@pipra.test` | `/portal` |
| Buyer (overdue) | `buyer3@pipra.test` | `/portal` |
| Buyer (part-paid) | `buyer5@pipra.test` | `/portal` |

To start again from clean demo data at any time, run `pnpm db:reset`.

---

## 2. Turning on real AI (Gemini)

The app works fully **without** an AI key. In offline mode:
- Photo suggestions come from the project's current stage.
- Update text comes from a template.
- The assistant answers from the buyer's records with rules, and searches documents with a local text-matching model.

Every screen shows when an answer came from this fallback.

To use real AI:

1. Get a free API key at <https://aistudio.google.com/apikey>.
2. In `apps/api/.env`, set:
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-key-here
   GEMINI_THINKING_LEVEL=low
   ```
   `GEMINI_THINKING_LEVEL` (`minimal`, `low`, `medium` or `high`) is for the newer Gemini models, which "think" before they answer. `low` keeps replies quick. Leave it empty for older models such as `gemini-2.5-flash`.
3. Restart the API. The admin **AI** page should now say "Gemini".
4. Signed in as the admin, press **Re-read all documents** on the same page so existing documents are re-indexed with Gemini embeddings.

**Safety built into the AI layer:**
- If Gemini is slow, down, out of quota, or returns something malformed, the app falls back to offline mode for that request. It never crashes.
- Each call has a timeout (`AI_TIMEOUT_MS`), retries with backoff (`AI_MAX_RETRIES`), and a limit of 4 calls at once.
- Every answer is checked against a schema before it is used.
- Each developer organisation has a monthly AI spending cap (default USD 5).
- Every AI call is logged on the admin **AI** page.

**What AI is allowed to do:**
- AI never publishes anything by itself. Engineers confirm photo suggestions, and managers approve every AI-written update.
- The assistant may only answer from the buyer's own records and documents. If it can't, it says so and offers to pass the question to the team.

---

## 3. The four AI features

| Feature | Where | What it does |
|---|---|---|
| Photo analysis | Engineer, *Post an update* | Suggests the stage and progress from the photos, and warns about dark, blurry or low-resolution photos |
| Update writer | Manager, *Reviews* | Drafts a buyer-friendly update from the engineer's notes and photos. The manager edits it, approves it or rejects it |
| Buyer assistant (RAG) | Buyer, *Ask a question* | Answers questions about the buyer's flat, payments, progress and documents, and shows where each answer came from |
| Delay-risk prediction | Manager, project *Risk* tab and dashboard | Scores each project from schedule slip, overdue stages, stale updates, handover changes and current pace, and explains the score in plain words |

---

## 4. Who can do what

| Action | Admin | Manager | Engineer | Buyer |
|---|:-:|:-:|:-:|:-:|
| Create projects, change handover date | ✓ | ✓ | | |
| Add flats, record bookings and payment plans | ✓ | ✓ | | |
| Record or void payments, issue receipts | ✓ | ✓ | | |
| Post photo updates | ✓ | ✓ | ✓ (assigned projects) | |
| Publish or reject updates | ✓ | ✓ | | |
| Upload documents | ✓ | ✓ | | |
| Manage staff accounts | ✓ | | | |
| See own flat, payments, receipts, documents | | | | ✓ |
| Ask the assistant, open support conversations | | | | ✓ |

Every staff action that changes money, dates or progress is written to an audit log. Buyers can only ever see their own flats and records. Requests for anything else return "not found".

---

## 5. Project layout

The API follows the course structure (`src/modules`, `src/common`, `src/config`, root `migrations/` and `test/`).

```
apps/
  api/                       NestJS API
    migrations/              TypeORM migrations (schema, audit details, CHECK constraints)
    src/
      main.ts                Bootstrap: /api/v1 prefix, helmet, ValidationPipe, Swagger at /api/docs
      app.module.ts          Global guards, interceptors, exception filter, middleware
      config/env.ts          .env schema, validated at startup
      common/                Decorators (@Public, @Roles, @CurrentUser, @ResponseMessage), guards,
                             filters, interceptors (envelope, timing, audit), middleware, paging DTO
      database/              Data source, entity list, demo seed
      modules/               One folder per feature: module, controllers, services, dto/, entities/
        auth users projects finance updates documents tickets ai audit
        mail notifications scheduler dashboard storage public health
    test/                    89 tests: unit, end-to-end, AI failure, course requirements, settings
    .env.example
  web/                       Next.js app
    src/app/                 Pages: public site, /register, /portal (buyer), /site (engineer), /admin (staff)
scripts/demo-check.mjs       Browser test of the full demo story
```

Every success response is `{ success, message, data, meta }`; lists put paging in `meta` (`total, page, pageSize, totalPages`). Every error is `{ success: false, statusCode, error, message, path, timestamp, requestId }`.

## 6. Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start API and web app with auto-reload |
| `pnpm test` | Run the 89 automated API tests (uses the separate `buildtrack_test` database) |
| `pnpm typecheck` | Check types in both apps |
| `pnpm build` | Production build of both apps |
| `pnpm db:reset` | Delete everything and reload the demo data |
| `pnpm --filter api migration:run` / `migration:revert` | Apply or undo migrations |
| `pnpm --filter api migration:generate migrations/Name` | Generate a migration from entity changes |
| `pnpm demo:check` | With the app running, drive a real browser through the whole demo and report any error |

API documentation: http://localhost:4000/api/docs (all 101 operations, with "Authorize" for a Bearer token from `POST /api/v1/auth/login`).

## 7. Reliability features

- Settings are checked at startup, and the app stops with a clear message if something is missing or wrong.
- Every error returns a clean JSON message and a request id that matches the server log. Database problems (duplicates, bad ids, timeouts) become proper 4xx/503 answers instead of crashes.
- Money is stored as exact decimals and calculated in whole poisha, never floating point. Receipt numbers are allocated in a single database statement, so two payments at the same moment never get the same number.
- Database CHECK constraints keep amounts positive and progress between 0 and 100. Booking a flat runs in a QueryRunner transaction with a row lock and rolls back fully on any error.
- Every create, update and delete is written to the audit log with old and new values, IP address and request id (`GET /api/v1/audit-logs`, admin only).
- Payments are voided, never deleted. Overall progress can only go down with a manager's reason.
- Database migrations run automatically on start. Connections retry if the database starts late. Queries time out after 15 seconds.
- Uploads are checked by their real file type, not the name. Photos are resized and their GPS/location data is removed.
- The daily scheduler (reminders, overdue status, risk scores) runs once even if several API copies are running.
- Notifications can never break the action that triggered them. Emails are never sent twice.
- Login is rate-limited. Passwords use bcrypt (cost 12). Tokens are in httpOnly cookies, and refresh tokens rotate and are revoked if reused.
- In the web app, failed requests show a retry option, lost sessions refresh silently, and every page has an error boundary.

## 8. Known limitations

- SMS is printed to the API console. Connecting a real SMS gateway (for example SSL Wireless) is one class in `notifications/messaging.service.ts`.
- Files are stored on the API server's disk (`STORAGE_DIR`). For hosting on several servers, swap `storage.service.ts` for S3 or Cloudinary.
- Online payment (bKash or SSLCommerz checkout) is not included. Staff record payments that were made by bank, cash, bKash or cheque.
- The interface is in English. Dates are shown in Bangladesh time.
