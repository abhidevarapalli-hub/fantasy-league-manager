# Project Name: Fantasy League Manager
 
## Tech Stack
 
### Frontend
- Framework: React 18.3 with TypeScript
- Build Tool: Vite 5.4 (with SWC for fast compilation)
- Routing: React Router DOM 6.30
### UI & Styling
- CSS Framework: Tailwind CSS 3.4 with tailwindcss-animate
- Component Library: shadcn/ui (built on Radix UI primitives)
- Icons: Lucide React
- Charts: Recharts
### State Management & Data Fetching
- Server State: TanStack React Query 5.83
- Client State: Zustand 5.0
- Forms: React Hook Form with Zod validation
### Backend & Database
- Backend-as-a-Service: Supabase (PostgreSQL database with auth, realtime, and storage)
- External API: Cricbuzz Cricket API via RapidAPI (proxied through Vite dev server)
### Development Tools
- Language: TypeScript 5.8
- Linting: ESLint 9 with React hooks and React Refresh plugins
- Package Manager: npm and bun
### Key Utilities
- Date handling: date-fns with timezone support
- Styling utilities: clsx, tailwind-merge, class-variance-authority
 
## Current Priority
 
League Manager Abilities
- Ability to edit roster configuration
- Ability to modify scores
- Ability to add/remove players from teams
- Ability to remove players from league
- Ability to modify draft settings (only before draft is done)
- Any special settings regarding league waivers, playoffs

## Product Context

The Cricket Fantasy App helps users:
- Create fantasy teams for cricket matches and tournaments
- Track player performance and fantasy points
- Compete in leagues and leaderboards
- Get projections, stats, and insights in near-real time

Key characteristics:
- Data-heavy (matches, players, stats, scoring rules)
- Event-driven (match updates, score changes)
- Read-heavy with predictable spikes during live games
 
## Coding Rules
 
- Use TypeScript for all new files
- Test critical functions
- Comment complex logic
- Use semantic commits
- Always check the browser console for errors
- Verify frontend changes on the browser
- Use strict typing whenever possible
- Use the playwright MCP when asked to verify changes in the browser
- Look for servers before starting a new server, kill old ones if a new one needs to start
- Consider database schema changes with future scalability in mind

## Local Development Setup

### Prerequisites
- Docker (via Colima or Docker Desktop)
  - If using Colima with VZ driver, analytics is disabled in config.toml to avoid docker socket mount issues
  - For Colima users with multiple profiles (e.g. work + personal), ensure the correct Docker context is active: `docker context use <profile>`
- Supabase CLI (`brew install supabase/tap/supabase`)

### Quick Start
```bash
npm run supabase:start    # Start local Postgres, Auth, Studio in Docker
npm run dev               # Start Vite dev server (seeded data only, no API calls)
```

Or use the one-command shortcut:
```bash
npm run dev:full          # Starts Supabase + Vite together
```

### Live API Mode
By default `npm run dev` uses only local seeded data. To enable Cricbuzz API calls:
```bash
npm run dev:live          # Vite with live API enabled
npm run dev:full:live     # Supabase + Vite with live API enabled
```
Requires `VITE_RAPIDAPI_KEY` in `.env.local`. The flag `VITE_USE_LIVE_API=true` is passed as a process env var and forwarded to `import.meta.env` via `vite.config.ts` `define`.

### How Environment Switching Works
- `npm run dev` loads `.env.development` + `.env.development.local` (local Supabase)
- `.env.development.local` (gitignored) holds secrets: `VITE_RAPIDAPI_KEY`, `VITE_RAPIDAPI_HOST`
- `npm run build` / Vercel uses production env vars from `.env` or Vercel dashboard
- No source code changes needed — Vite's mode-based env loading handles it

### Secret Files (gitignored, must be created manually)
- `supabase/.env` — Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- `.env.local` — RapidAPI key (`VITE_RAPIDAPI_KEY`, `VITE_RAPIDAPI_HOST`) — loaded for all Vite modes
- See `.env.example` for a template of all environment variables

### Edge Functions
- Edge runtime is excluded from `supabase start` for faster startup
- To test edge functions locally, run `npm run supabase:functions` separately
- Functions: `cricbuzz-proxy`, `live-stats-poller`, `match-lifecycle-manager`, `poll-trigger`

### Authentication (Google OAuth only)
- Login is Google OAuth only — no email/password
- Credentials go in `supabase/.env` (gitignored): `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Config uses `env()` substitution in `supabase/config.toml`
- Google Cloud Console redirect URI: `http://127.0.0.1:54321/auth/v1/callback`
- Users, profiles, and managers are created dynamically on first sign-in

### Port Handling
- Vite may bind to 8080, 8081, 8082, or 8083 depending on availability
- All are configured as allowed redirect URLs in `supabase/config.toml`
- `site_url` defaults to `http://localhost:8080`

### Useful Commands
- `npm run dev:live` — Start Vite with live Cricbuzz API enabled
- `npm run dev:full:live` — Start Supabase + Vite with live API
- `npm run supabase:reset` — Drop and recreate local DB (re-applies migrations + seed)
- `npm run supabase:status` — Show local Supabase URLs and keys
- `npm run supabase:stop` — Stop local Docker containers
- `npm run supabase:functions` — Serve edge functions locally
- Supabase Studio: http://127.0.0.1:54323

### Database
- Production: `ltelzlioeqrkekgndypl.supabase.co` (cloud)
- Local: `127.0.0.1:54322` (Docker, via `supabase start`)
- Migrations: `supabase/migrations/`
- Seed data: `supabase/seed.sql`

### Migration Deployment (CI-Only)

Production migrations can **only** be deployed through GitHub Actions CI. Local CLI usage is blocked by design.

**Guardrails in place:**
- `supabase/config.toml` uses `project_id = "local-dev"` — not a valid remote project, so `supabase db push` fails locally
- `npm run supabase:push` prints an error and exits — no accidental pushes
- `supabase:link` script has been removed — no linking to production locally
- CI `safety-check` job fails if anyone commits the production project ref back into `config.toml`
- The `deploy` job in `deploy-migrations.yml` only runs on `main` branch

**PR validation** — The CI workflow (`ci.yml`) includes a `migrate-check` job that spins up a local Supabase instance and runs `supabase db reset` to validate all migrations apply cleanly. This runs on every PR and push to `main`.

**Production deployment** — The `deploy-migrations.yml` workflow automatically deploys migrations to production when migration files change on `main`. It can also be triggered manually via `workflow_dispatch` (from `main` only).
- Validates migrations locally first, then deploys to production
- The `deploy` job uses a GitHub `production` environment — configure [environment protection rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules) to require manual approval before production deploys
- **Never** run `supabase db push` manually — it is blocked locally, and production deploys happen through CI only

**Required GitHub Actions secrets** (these live only in GitHub, never on developer machines):
| Secret | Purpose |
|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI auth (generate a CI-only token at supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | Production database password |
| `SUPABASE_PROJECT_REF` | Production project ref |

## Don't Change

- Production environment variables

## Living Document

This file should evolve with the app.
If Claude notices:
- Repeated patterns
- Architectural drift
- Painful workflows
It should propose updates to this file, not just code changes.

### Architecture Docs
- [Real-Time Draft Engine](docs/architecture/realtime-draft-engine.md): Explains the server-authoritative, low-latency draft architecture using Supabase Realtime, Edge Functions, and Zustand.