# Build notes and decisions

What was built against the BuildTrack spec, and where we chose differently and why.

## Status

All spec features are built: public site, buyer portal, engineer site app, staff admin, the 4 AI features, notifications, the daily scheduler, reports with CSV export, and audit log.

| Check | Result |
|---|---|
| API tests (`pnpm test`) | 89: 16 unit, 36 API end-to-end, 10 AI-failure, 23 course requirements, 4 company settings (all 89 pass) |
| Swagger | 101 operations, each with a summary |
| Type check, both apps | Clean |
| Production build, web | 30 routes |
| Browser demo (`pnpm demo:check`) | 12 of 12 steps, no browser or server errors |

## Decisions

| Decision | Why |
|---|---|
| **TypeORM instead of Prisma** | Prisma needs to download a native engine at install time, which failed on restricted networks. TypeORM is plain TypeScript, works anywhere Node works, and is what most NestJS courses teach. |
| **Gemini as the AI provider, behind one gateway** | It has a free tier, good JSON output and an embeddings model. All AI calls go through `ai/ai.service.ts`, so switching providers means writing one provider class. |
| **Offline AI mode** | The app has to demo and pass tests with no key and no internet. Each AI feature has a deterministic fallback, and the UI labels which one answered. |
| **Local hashing embeddings when offline** | Offline embeddings use 512-dimension word hashing, so document search still works. Gemini embeddings use 768 dimensions, and each chunk records which model made it, so the two are never mixed. |
| **pgvector optional** | It is used when the extension is available, otherwise similarity is computed in the app. Installing PostgreSQL on Windows without pgvector still works. |
| **Plain Tailwind components, no shadcn or Turborepo** | Fewer moving parts for a two-person team. A pnpm workspace is enough for two apps. |
| **Local disk storage with signed links** | No cloud account is needed to run it. File links expire and are signed, so they cannot be guessed. |
| **Email addresses unique across all organisations** | Login is by email only, so one person has one account. |
| **Stage weights adjusted to total 100** | The spec's fixed weights went over 100 for buildings above 30 floors. Weights are now apportioned so they always total exactly 100. |
| **AI-written update title is what buyers see** | The engineer's title is a working note. The manager approves (and can edit) the AI-written title and text. |

## CSC4161 course alignment

- Restructured to the course layout: `src/modules`, `src/common`, `src/config`, root `migrations/`.
- Added `POST /auth/register` (buyers join the `DEFAULT_ORG_SLUG` developer), bcrypt cost 12, full CRUD with paging on projects, stages, flats, users and documents.
- Response envelope, timing header, audit interceptor, request-context middleware, CHECK constraints migration.
- Booking uses an explicit QueryRunner transaction; action endpoints (approve, void, waive...) return 200.
- Web: register page and admin Activity log.

## Possible next steps

- Real SMS gateway and online payment checkout.
- Bangla interface.
- Cloud file storage for multi-server hosting.
- Push notifications for the engineer and buyer apps (PWA).
