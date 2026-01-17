-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create draft_picks table to store draft state
CREATE TABLE public.draft_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round INTEGER NOT NULL CHECK (round >= 1 AND round <= 14),
  pick_position INTEGER NOT NULL CHECK (pick_position >= 1 AND pick_position <= 8),
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round, pick_position)
);

-- Create draft_order table to store which manager is in which draft position
CREATE TABLE public.draft_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 8) UNIQUE,
  manager_id UUID REFERENCES public.managers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create draft_state table to track if draft is finalized
CREATE TABLE public.draft_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for draft_picks
CREATE POLICY "Anyone can view draft picks" ON public.draft_picks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert draft picks" ON public.draft_picks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update draft picks" ON public.draft_picks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete draft picks" ON public.draft_picks FOR DELETE USING (true);

-- RLS policies for draft_order
CREATE POLICY "Anyone can view draft order" ON public.draft_order FOR SELECT USING (true);
CREATE POLICY "Anyone can insert draft order" ON public.draft_order FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update draft order" ON public.draft_order FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete draft order" ON public.draft_order FOR DELETE USING (true);

-- RLS policies for draft_state
CREATE POLICY "Anyone can view draft state" ON public.draft_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert draft state" ON public.draft_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update draft state" ON public.draft_state FOR UPDATE USING (true);

-- Initialize draft_order with 8 positions
INSERT INTO public.draft_order (position) VALUES (1), (2), (3), (4), (5), (6), (7), (8);

-- Initialize draft_state
INSERT INTO public.draft_state (is_finalized) VALUES (false);

-- Create trigger for updated_at on draft_picks
CREATE TRIGGER update_draft_picks_updated_at
BEFORE UPDATE ON public.draft_picks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();