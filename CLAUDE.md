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
 
## Don't Change
 
- Production environment variables

## Living Document

This file should evolve with the app.
If Claude notices:
- Repeated patterns
- Architectural drift
- Painful workflows
It should propose updates to this file, not just code changes.