-- Add league_id columns to draft tables for multi-league isolation
ALTER TABLE public.draft_state 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_pick_start_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id);

-- Create a unique index for draft_state per league
CREATE UNIQUE INDEX IF NOT EXISTS draft_state_league_id_idx ON public.draft_state(league_id);

ALTER TABLE public.draft_order
ADD COLUMN IF NOT EXISTS auto_draft_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id);

-- Create a unique index for draft_order per league and position
CREATE UNIQUE INDEX IF NOT EXISTS draft_order_league_id_pos_idx ON public.draft_order(league_id, position);

ALTER TABLE public.draft_picks
ADD COLUMN IF NOT EXISTS is_auto_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES public.leagues(id);

-- Backfill league_id if possible (for existing data, if any)
-- This is just a safety measure, assuming currently everything belongs to the primary league if it exists
DO $$
DECLARE
    first_league_id UUID;
BEGIN
    SELECT id INTO first_league_id FROM public.leagues LIMIT 1;
    IF first_league_id IS NOT NULL THEN
        UPDATE public.draft_state SET league_id = first_league_id WHERE league_id IS NULL;
        UPDATE public.draft_order SET league_id = first_league_id WHERE league_id IS NULL;
        UPDATE public.draft_picks SET league_id = first_league_id WHERE league_id IS NULL;
    END IF;
END $$;
