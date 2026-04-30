# Embar

A personal OS for complex work. Embar unifies tasks, documents, and email into one context-aware environment — with an AI layer that acts, not just advises.

**Phase 1 scope (this repo): Tasks module.** Email, Documents, and AI Agents are on the roadmap.

---

## What's built

| Sprint | Feature | Status |
|--------|---------|--------|
| S1 | Auth (email + Google OAuth), workspace creation, app shell | ✅ Done |
| S2 | Entity (project/client) creation and management | ✅ Done |
| S3 | Core task CRUD — create, edit, delete, subtasks | ✅ Done |
| S4 | Today / Week / Month / All views, task states, timer | ✅ Done |

The app shell includes a persistent AI Bar (visual, wired up in Sprint 10), icon-only sidebar, workspace switcher, and dark/light theme.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router + TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (UI) + server components (data) |
| Database | Supabase / PostgreSQL + pgvector |
| Auth | Supabase Auth — email + Google OAuth |
| AI inference | Claude claude-sonnet-4-6 (Anthropic SDK) — Sprint 10 |
| Embeddings | OpenAI text-embedding-3-small — Sprint 9 |
| Hosting | Vercel (Next.js) + Railway (FastAPI AI service) |

---

## Architecture

Logical microservices from day one. The Next.js app handles all user-facing logic and database writes. A separate FastAPI service (`embar-ai`) handles AI inference — it proposes, the Next.js app executes. Services communicate via HTTP only; no cross-service DB access.

**Key data model decisions:**
- `workspace_id` on every table — RLS enforces user isolation at the DB level
- `metadata JSONB` on every table — module extensions write here, core schema never changes
- `deleted_at TIMESTAMP` everywhere — soft deletes only
- Item states: `focus` | `planned` | `carry-on` | `unplanned` | `someday` | `done`
- Only one `focus` item per workspace at a time

---

## Local setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- A Supabase project

### 1. Clone and install

```bash
git clone https://github.com/elisacoh/embar.git
cd embar
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key        # needed for Sprint 10+
OPENAI_API_KEY=your_openai_key              # needed for Sprint 9+
SUPABASE_JWT_SECRET=your_jwt_secret
AI_SERVICE_URL=http://localhost:8000        # local AI service
```

### 3. Apply database migrations

```bash
supabase db push
```

Migrations live in `supabase/migrations/`. They set up all tables, RLS policies, indexes, and the midnight Edge Function that moves overdue tasks to `carry-on`.

### 4. Run the dev server

```bash
pnpm dev
```

App runs on [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
src/
├── app/                    # Next.js App Router — pages, layouts, API routes, server actions
│   ├── (auth)/             # Login + signup pages (unauthenticated route group)
│   ├── actions/            # Server actions (items, entities, workspace)
│   ├── api/                # Route handlers
│   └── dashboard/          # Main app entry point (protected)
├── components/
│   ├── shell/              # App chrome: Topbar, Sidebar, AIBar, WorkspaceSelector
│   ├── tasks/              # Tasks module: Today/Week/Month/All views, detail panel, quick create
│   ├── entities/           # Entity management
│   └── ui/                 # shadcn/ui primitives (do not edit directly)
├── lib/
│   ├── supabase/           # Supabase client/server/route helpers
│   ├── types.ts            # Shared TypeScript types
│   └── normalize.ts        # Data normalization utilities
└── stores/
    └── ui.ts               # Zustand store for UI state
supabase/
├── migrations/             # SQL migration files
└── functions/              # Supabase Edge Functions
```

---

## Scripts

```bash
pnpm dev          # start dev server on localhost:3000
pnpm build        # production build
pnpm lint         # ESLint
pnpm tsc --noEmit # type check
pnpm test         # run Vitest tests
```

---

## Roadmap

- **Sprint 5** — Week view drag-and-drop
- **Sprint 6** — Entity kanban (Flow + Structure modes)
- **Sprint 7** — Theme views (built-in + AI-inferred)
- **Sprint 8** — NLP quick create
- **Sprint 9** — AI category inference + embeddings
- **Sprint 10** — AI Bar: query / action / create / automate (SSE streaming)
- **Sprint 11** — Daily planning + dashboard intelligence
- **Sprint 12** — Recurring tasks + sessions
- **Sprint 13** — Automation rules
- **Sprint 14** — Polish, keyboard shortcuts, PKL behavioral logging

---

## License

MIT
