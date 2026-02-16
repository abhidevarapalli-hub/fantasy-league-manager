# Fantasy League Manager

A fantasy cricket league management application that lets you create leagues, draft players, manage rosters, and track live scores.

## Features

- **League Management**: Create and manage multiple fantasy cricket leagues
- **Player Drafts**: Conduct live drafts with your league members or run mock drafts to practice
- **Roster Management**: Build and manage your team roster with validation rules
- **Live Scores**: Track real-time cricket match scores via Cricbuzz integration
- **Trading System**: Propose and negotiate trades with other managers
- **Standings & History**: View league standings and historical performance

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Backend**: Supabase (PostgreSQL, Authentication, Realtime)
- **Cricket Data**: RapidAPI Cricbuzz Cricket API

## Prerequisites

- Node.js 18+ (install via [nvm](https://github.com/nvm-sh/nvm))
- npm or bun package manager
- Docker (via [Colima](https://github.com/abiosoft/colima) or Docker Desktop) for local Supabase
  - **Colima note**: If using Colima with the VZ virtualization framework, analytics must be disabled in `supabase/config.toml` (`[analytics] enabled = false`) due to a docker socket mount incompatibility. This is already configured.
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [RapidAPI](https://rapidapi.com/) account with Cricbuzz Cricket API subscription (for production)

## Getting Started (Local Development)

### 1. Clone and install

```bash
git clone <repository-url>
cd fantasy-league-manager
npm install
```

### 2. Start local Supabase

This spins up a full Supabase stack (Postgres, Auth, Studio) in Docker, applies all migrations, and seeds test data:

```bash
npm run supabase:start
```

### 3. Start the dev server

```bash
npm run dev
```

Or use the one-command shortcut:

```bash
npm run dev:full    # starts Supabase + Vite together
```

The app will be available at `http://localhost:8080` (or the next available port — Vite will auto-increment if 8080 is in use). It automatically connects to the local Supabase instance — no `.env` file needed for local development.

### 4. Set up Google OAuth

Authentication is Google OAuth only. Create `supabase/.env` (gitignored) with your Google Cloud OAuth credentials:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

The redirect URI in Google Cloud Console must be set to `http://127.0.0.1:54321/auth/v1/callback`.

Users, profiles, and managers are created dynamically on first sign-in.

### 5. Access Supabase Studio

Open http://127.0.0.1:54323 to browse the local database, inspect tables, and run queries.

## Production Setup

For production builds (e.g. Vercel), copy the example env file and fill in your cloud Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `VITE_SUPABASE_PROJECT_ID`: Your Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon/public key
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_RAPIDAPI_KEY`: Your RapidAPI key for Cricbuzz
- `VITE_RAPIDAPI_HOST`: Cricbuzz API host (usually `cricbuzz-cricket.p.rapidapi.com`)

## How Environment Switching Works

The app uses Vite's built-in env file hierarchy — no code changes needed:

- **`npm run dev`** (mode=development) loads `.env.development` which points to `http://127.0.0.1:54321` (local Docker)
- **`npm run build`** (mode=production) uses `.env` or Vercel dashboard env vars pointing to the cloud Supabase project

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (connects to local Supabase) |
| `npm run build` | Build for production |
| `npm run build:dev` | Build in development mode |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |
| `npm run supabase:start` | Start local Supabase (Postgres, Auth, Studio) |
| `npm run supabase:stop` | Stop local Supabase containers |
| `npm run supabase:reset` | Drop and recreate local DB (re-apply migrations + seed) |
| `npm run supabase:status` | Show local Supabase URLs and keys |
| `npm run supabase:functions` | Serve edge functions locally |
| `npm run supabase:push` | Push migrations to production (use with caution) |
| `npm run supabase:deploy-functions` | Deploy edge functions to production |
| `npm run dev:full` | Start local Supabase + Vite dev server |

## Database

- **Production**: Supabase cloud project
- **Local**: Docker containers via `supabase start`
- **Migrations**: `supabase/migrations/` (applied automatically on `supabase start` or `supabase db reset`)
- **Seed data**: `supabase/seed.sql` (loaded after migrations during reset)

### Deploying schema changes to production

```bash
npm run supabase:push
```

## Project Structure

```
src/
├── components/     # React components (UI, features)
├── contexts/       # React contexts (Auth, Game state)
├── hooks/          # Custom React hooks
├── integrations/   # External service clients (Supabase, Cricbuzz)
├── lib/            # Utilities and type definitions
├── pages/          # Page components (routes)
└── store/          # Zustand stores

supabase/
├── config.toml     # Local Supabase configuration
├── seed.sql        # Test data for local development
├── migrations/     # SQL migration files
└── functions/      # Supabase Edge Functions
    ├── cricbuzz-proxy/
    ├── live-stats-poller/
    ├── match-lifecycle-manager/
    └── poll-trigger/
```

## License

This project is private.
