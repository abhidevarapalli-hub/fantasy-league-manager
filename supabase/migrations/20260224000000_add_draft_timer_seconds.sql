-- Add draft_timer_seconds column to the leagues table
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS draft_timer_seconds INTEGER DEFAULT 60;

-- Update existing leagues to have the default value
UPDATE public.leagues SET draft_timer_seconds = 60 WHERE draft_timer_seconds IS NULL;
