# Embar

Personal productivity platform with an AI execution layer.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude Sonnet (Anthropic) + OpenAI embeddings
- **Package manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)

### Setup

```bash
# 1. Clone the repo
git clone git@github.com:elisacoh/embar.git
cd embar

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in the values in .env.local

# 4. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Branch Strategy

- `main` — production-ready, never pushed to directly
- `dev` — active development, all work branches off here

## Project Structure

```
src/
├── app/          # Next.js App Router pages and layouts
├── components/   # Shared UI components
│   └── ui/       # shadcn/ui components
└── lib/          # Utilities and helpers
```

## Environment Variables

See `.env.example` for all required keys.
