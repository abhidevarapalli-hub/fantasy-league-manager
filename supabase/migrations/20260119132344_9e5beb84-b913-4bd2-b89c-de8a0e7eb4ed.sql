-- Create trades table for tracking trade proposals
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposer_id UUID NOT NULL REFERENCES public.managers(id),
  target_id UUID NOT NULL REFERENCES public.managers(id),
  proposer_players TEXT[] NOT NULL DEFAULT '{}',
  target_players TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  parent_trade_id UUID REFERENCES public.trades(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view trades
CREATE POLICY "Anyone can view trades"
ON public.trades FOR SELECT
USING (true);

-- Allow anyone to insert trades
CREATE POLICY "Anyone can insert trades"
ON public.trades FOR INSERT
WITH CHECK (true);

-- Allow anyone to update trades
CREATE POLICY "Anyone can update trades"
ON public.trades FOR UPDATE
USING (true);

-- Allow anyone to delete trades
CREATE POLICY "Anyone can delete trades"
ON public.trades FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for trades table
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;