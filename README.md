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
- [Supabase](https://supabase.com/) account and project
- [RapidAPI](https://rapidapi.com/) account with Cricbuzz Cricket API subscription

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd fantasy-league-manager
```

### 2. Set up environment variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `VITE_SUPABASE_PROJECT_ID`: Your Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon/public key
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_RAPIDAPI_KEY`: Your RapidAPI key for Cricbuzz
- `VITE_RAPIDAPI_HOST`: Cricbuzz API host (usually `cricbuzz-cricket.p.rapidapi.com`)

### 3. Install dependencies

```bash
npm install
# or
bun install
```

### 4. Run the development server

```bash
npm run dev
# or
bun dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run build:dev` | Build in development mode |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Database Setup

This project uses Supabase. Database migrations are located in the `supabase/migrations/` directory. To apply migrations:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
2. Link your project: `supabase link --project-ref <your-project-id>`
3. Push migrations: `supabase db push`

## Project Structure

```
src/
├── components/     # React components (UI, features)
├── contexts/       # React contexts (Auth, Game state)
├── hooks/          # Custom React hooks
├── integrations/   # External service clients (Supabase, Cricbuzz)
├── lib/            # Utilities and type definitions
└── pages/          # Page components (routes)
```

## License

This project is private.
