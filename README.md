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

The app will be available at `http://localhost:8080` (or the next available port — Vite will auto-increment if 8080 is in use). It automatically connects to the local Supabase instance via `.env.development`.

By default, `npm run dev` uses only local seeded data — no Cricbuzz API calls are made. To enable live cricket data from Cricbuzz, use:

```bash
npm run dev:live        # Vite dev server with live API enabled
npm run dev:full:live   # Supabase + Vite with live API enabled
```

This requires a valid `VITE_RAPIDAPI_KEY` in `.env.local` (see step 5).

### 4. Set up Google OAuth

Authentication is Google OAuth only. Create `supabase/.env` (gitignored) with your Google Cloud OAuth credentials:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

The redirect URI in Google Cloud Console must be set to `http://127.0.0.1:54321/auth/v1/callback`.

Users, profiles, and managers are created dynamically on first sign-in.

### 5. Set up RapidAPI (for live cricket data)

Only needed if you use `npm run dev:live`. Create `.env.local` (gitignored) with your RapidAPI credentials:

```
VITE_RAPIDAPI_KEY=your-rapidapi-key
VITE_RAPIDAPI_HOST=cricbuzz-cricket.p.rapidapi.com
```

`.env.local` is loaded for all Vite modes, so the key is available in both default and live modes. See `.env.example` for a full list of environment variables.

### 6. Run edge functions (optional)

Edge runtime is excluded from `supabase start` for faster startup. If you need to test edge functions locally (e.g. cricbuzz-proxy, live-stats-poller):

```bash
npm run supabase:functions
```

### 7. Access Supabase Studio

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

- **`npm run dev`** (mode=development) loads `.env.development` which points to `http://127.0.0.1:54321` (local Docker). Uses seeded data only — no API calls.
- **`npm run dev:live`** — same as `dev` but sets `VITE_USE_LIVE_API=true`, enabling Cricbuzz API calls (requires `VITE_RAPIDAPI_KEY` in `.env.local`)
- **`npm run build`** (mode=production) uses `.env` or Vercel dashboard env vars pointing to the cloud Supabase project

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (local Supabase, seeded data only) |
| `npm run dev:live` | Start Vite dev server with live Cricbuzz API enabled |
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
| `npm run dev:full:live` | Start local Supabase + Vite with live API |

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

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `supabase start` fails with Docker errors | Ensure Docker (Colima or Docker Desktop) is running. For Colima: `colima start` |
| Multiple Colima profiles causing issues | Set the correct Docker context: `docker context use <profile>` |
| Port 8080 already in use | Vite auto-increments to 8081–8083. All are configured as allowed redirect URLs in Supabase. |
| Google OAuth redirect fails | Verify the redirect URI in Google Cloud Console is `http://127.0.0.1:54321/auth/v1/callback` |
| Cricket data not loading | Ensure you're using `npm run dev:live` and `.env.local` has a valid `VITE_RAPIDAPI_KEY` |

## License

This project is private.
