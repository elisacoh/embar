# Embar — AI Coding Context

## Product

Personal OS for complex work. Unifies tasks, documents, email into one context-aware environment.
AI layer that **acts**, not just advises — closes the loop between knowing and doing.
Phase 1 scope: Tasks module only. Email (P2), Documents (P3), Agents (P4).

## Current status

Pre-sprint: COMPLETE. Starting Sprint 1.

## Stack

Logical microservices from day one. Services communicate via HTTP API only — no cross-service database access. All configuration via environment variables. Deployable as a simple setup now, true microservices later when scale demands it.

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Frontend     | Next.js 14 App Router + TypeScript strict     |
| Styling      | Tailwind CSS + shadcn/ui (Radix, Nova preset) |
| State        | Zustand (UI) + TanStack Query (server)        |
| Database     | Supabase / PostgreSQL + pgvector              |
| Auth         | Supabase Auth — email + Google OAuth          |
| AI inference | Claude claude-sonnet-4-6 (Anthropic SDK)      |
| Embeddings   | OpenAI text-embedding-3-small (1536 dims)     |
| AI service   | FastAPI Python 3.12 — repo: embar-ai          |
| Hosting      | Vercel (Next.js) + Railway (FastAPI)          |

## Repositories

- `embar` — this repo, Next.js app
- `embar-ai` — FastAPI AI service (separate repo, separate deploy)

## Critical architecture rules

- `workspace_id` on **every** table — RLS enforces user isolation at DB level
- `metadata JSONB` on every table — module extensions write here, never touch core schema
- `ai_summary TEXT` on every object — pre-computed token-efficient string, internal only, never shown to users
- `deleted_at TIMESTAMP` everywhere — soft deletes only, never hard delete core objects
- **AI service proposes. Next.js app executes.** AI service never writes to DB for user-initiated actions
- Every AI action requires user confirmation before execution
- `NEXT_PUBLIC_` prefix = safe for browser. Everything else = server only

## Data model

```
Workspace
└── workspace_members (many-to-many via workspace_id + user_id)
└── Entity (organising concept: client, project, subject)
    └── Item (unified tasks + events)
        └── subtasks (JSONB on item)
        └── item_links (cross-module: item|email|document|contact)
    └── Session (time-windowed batch/worksheet)
└── Contact
└── entity_contacts (junction)
└── Document
└── Email
└── Automation
└── Agent (Phase 4 — scaffolded only)
└── Interaction (PKL logging — every user action)
└── entity_templates
```

## Item states (system-managed, 5-state system)

`focus` | `planned` | `carry-on` | `unplanned` | `someday` | `done`

- Only one `focus` item per workspace at a time — enforced in UI and DB
- `carry-on` = midnight Edge Function moves unfinished items here
- `hard_deadline = true` → AI never reschedules this item

## Item intelligence fields

- `urgency`: critical | urgent | normal
- `work_type`: deep | shallow | admin
- `ai_category`: AI-inferred (Bug, Admin, Referral...)
- `embedding`: vector(1536) for semantic search
- `waiting_for`: references contacts(id), triggers stale detection at 48h

## AI context engine (token budget per call)

- Layer 1 — user mental model: ~300 tokens (always)
- Layer 2 — structured query results: ~500 tokens (always)
- Layer 3 — semantic retrieval via pgvector: ~300 tokens (when needed)
- System prompt: ~500 tokens
- Total typical: 1,200–1,700 tokens

## Semantic search functions (registered in Supabase)

- `match_items(query_embedding, workspace_id, threshold=0.7, count=8)`
- `match_emails(query_embedding, workspace_id, threshold=0.7, count=8)`
- `match_documents(query_embedding, workspace_id, threshold=0.7, count=8)`

## AI service endpoints (build by sprint)

```
Live now:    GET  /ai/health
Sprint 9:    POST /ai/infer-properties
             POST /ai/generate-summary
             POST /ai/generate-embedding
Sprint 10:   POST /ai/bar (SSE streaming — query|action|create|automate modes)
             POST /ai/replan
Sprint 11:   POST /ai/daily-plan
             POST /ai/context-brief
Sprint 13:   POST /ai/create-automation
Sprint 14:   POST /ai/suggest-connections
             POST /ai/parse-natural-language
```

## System automations (Supabase Edge Functions)

- Midnight daily → items past due + not done → state = `carry-on`
- Every 4h → stale detection (waiting_for > 48h, stuck in planned > 3d)
- 2am daily → refresh entity `ai_categories`
- 3am daily → regenerate stale embeddings

## App layout (Section 4.1)

```
┌─────────────────────────────────────┐
│ Topbar (48px) — logo | workspace selector | user │
├──────┬──────────────────────────────┤
│ Side │ Module top nav (40px)        │
│ bar  │ [Time views] | [Entities] | [Themes] │
│ 56px ├──────────────────────────────┤
│      │ Main content area            │
├──────┴──────────────────────────────┤
│ AI Bar (52px, persistent)           │
└─────────────────────────────────────┘
```

- Sidebar: icon-only, 56px, no labels, tooltips on hover
- AI bar modes (auto-detected): query | action | create | automate

## File structure conventions

```
src/
├── app/                    # Next.js App Router pages + layouts
├── components/
│   ├── ui/                 # shadcn/ui — do not modify directly
│   └── [feature]/          # feature components (shell/, tasks/, entities/...)
├── lib/
│   ├── supabase/           # client + server Supabase helpers
│   ├── hooks/              # shared React hooks
│   └── utils.ts
└── stores/                 # Zustand stores
```

## Code conventions

- TypeScript strict — no `any`, no implicit returns
- `import type { X }` for type-only imports
- Server components by default — `'use client'` only when needed
- Always handle loading + error states (skeleton screens, not blank)
- Optimistic updates for all mutations via TanStack Query
- Auto-save with 500ms debounce on detail panel field changes

## Sprint 1 — current sprint

**Goal:** User can log in, create a workspace, and see the empty application shell.

Deliverables:

- Login + signup pages (email/password + Google OAuth)
- Protected route middleware (unauthenticated → /login)
- Session management via Supabase Auth
- Application shell: topbar, 56px icon-only sidebar, AI bar (visual only)
- Workspace auto-created on first signup
- Workspace selector dropdown + switching
- Last active workspace persisted to DB

Acceptance criteria:

- Full signup → workspace → shell in under 60 seconds
- Google OAuth works end to end with workspace auto-creation
- RLS: User A cannot see User B's workspaces — verified with two test users
- Shell renders without errors on desktop + mobile

## Sprint overview (Phase 1)

| Sprint | Focus                                   | Week  |
| ------ | --------------------------------------- | ----- |
| S1     | Shell + auth + workspace                | 1     |
| S2     | Entity creation + management            | 2     |
| S3     | Core task CRUD                          | 3     |
| S4     | Today view + task states + timer        | 4     |
| S5     | Week view + All view + drag-drop        | 5     |
| S6     | Entity kanban (Flow + Structure)        | 6     |
| S7     | Theme views (built-in + AI-inferred)    | 7     |
| S8     | NLP quick create                        | 8     |
| S9     | AI category inference + embeddings      | 9     |
| S10    | AI bar core (SSE streaming)             | 10–11 |
| S11    | Daily planning + dashboard intelligence | 12    |
| S12    | Recurring tasks + sessions              | 13    |
| S13    | Automation rules                        | 14    |
| S14    | Polish + PKL logging + performance      | 15–16 |

## Key keyboard shortcuts (implement in S14)

- `Cmd/Ctrl+N` → new task
- `Cmd/Ctrl+K` → focus AI bar
- `Cmd/Ctrl+/` → keyboard shortcuts modal
- `G D/T/E/O` → navigate to Dashboard/Tasks/Email/Documents
- `T/W/A` → Today/Week/All view
- `Space` → mark focused task done

## PKL (Personal Knowledge Layer)

Log **every** meaningful user action to `interactions` table from Sprint 1 onward.
This data cannot be retroactively collected. Fire-and-forget, never block UI.
Phase 3 will build the full behavioral graph from this data.
Fields: action_type, object_type, object_id, context (entity_id, time_of_day, day_of_week, energy_state, active_view), ai_suggestion, duration_ms.

## Development

### Run Next.js locally

```bash
cd ~/embar
pnpm dev          # starts on localhost:3000
pnpm build        # production build check
pnpm lint         # ESLint
pnpm tsc --noEmit # typecheck
```

### Run AI service locally

```bash
cd ~/embar-ai
source venv/bin/activate
python main.py    # starts on localhost:8000
# health check: curl http://localhost:8000/ai/health
```

### Before every commit (Husky runs this automatically)

```bash
pnpm lint-staged  # lint + prettier on staged files
pnpm tsc --noEmit # typecheck
```

### Database migrations

```bash
cd ~/embar
supabase db push  # apply new migration files to remote DB
```

New migrations go in `supabase/migrations/` as `YYYYMMDDHHMMSS_description.sql`.

### Environment variables

- Next.js: `~/embar/.env.local` (see `.env.example`)
- AI service: `~/embar-ai/.env` (see `.env.example`)
- Never commit either file — both are gitignored

### Deploy

- Next.js → push to `main` → GitHub Actions auto-deploys to Vercel
- AI service → push to `main` on embar-ai → Railway auto-deploys
- Never push directly to `main` — always PR from `dev`

### Branch strategy

- `main` → production, never push directly
- `dev` → active development
- Feature branches → `feature/sprint1-auth`, `fix/task-state-bug`
- All work merges to `dev` first, then `dev` → `main` via PR
