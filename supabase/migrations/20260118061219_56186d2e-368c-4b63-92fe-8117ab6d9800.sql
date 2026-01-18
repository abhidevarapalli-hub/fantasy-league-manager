-- Create table for historical records (past seasons data)
CREATE TABLE public.historical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_name TEXT NOT NULL UNIQUE,
  championships INTEGER NOT NULL DEFAULT 0,
  top_3_finishes INTEGER NOT NULL DEFAULT 0,
  historical_wins INTEGER NOT NULL DEFAULT 0,
  historical_losses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for head-to-head records
CREATE TABLE public.head_to_head (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager1_name TEXT NOT NULL,
  manager2_name TEXT NOT NULL,
  manager1_wins INTEGER NOT NULL DEFAULT 0,
  manager2_wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(manager1_name, manager2_name)
);

-- Enable RLS
ALTER TABLE public.historical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.head_to_head ENABLE ROW LEVEL SECURITY;

-- RLS policies for historical_records
CREATE POLICY "Anyone can view historical records"
  ON public.historical_records FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert historical records"
  ON public.historical_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update historical records"
  ON public.historical_records FOR UPDATE
  USING (true);

-- RLS policies for head_to_head
CREATE POLICY "Anyone can view head to head"
  ON public.head_to_head FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert head to head"
  ON public.head_to_head FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update head to head"
  ON public.head_to_head FOR UPDATE
  USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_historical_records_updated_at
  BEFORE UPDATE ON public.historical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_head_to_head_updated_at
  BEFORE UPDATE ON public.head_to_head
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed historical records data from past 2 seasons
INSERT INTO public.historical_records (manager_name, championships, top_3_finishes, historical_wins, historical_losses) VALUES
  ('Vamsi', 1, 1, 8, 6),
  ('Jasti', 1, 1, 8, 6),
  ('Krithik', 0, 2, 9, 5),
  ('Krishna', 0, 1, 9, 5),
  ('Abhi', 0, 1, 7, 7),
  ('Akash', 0, 0, 3, 4),
  ('Sahith', 0, 0, 5, 9),
  ('Santosh', 0, 0, 5, 9),
  ('Kush', 0, 0, 2, 5);

-- Seed head-to-head data (storing alphabetically to avoid duplicates)
-- Format: manager1 vs manager2, manager1_wins, manager2_wins
INSERT INTO public.head_to_head (manager1_name, manager2_name, manager1_wins, manager2_wins) VALUES
  ('Abhi', 'Akash', 0, 1),
  ('Abhi', 'Jasti', 0, 2),
  ('Abhi', 'Krishna', 2, 0),
  ('Abhi', 'Krithik', 1, 1),
  ('Abhi', 'Kush', 1, 0),
  ('Abhi', 'Sahith', 1, 1),
  ('Abhi', 'Santosh', 2, 0),
  ('Abhi', 'Vamsi', 0, 2),
  ('Akash', 'Jasti', 1, 0),
  ('Akash', 'Krishna', 0, 1),
  ('Akash', 'Krithik', 0, 1),
  ('Akash', 'Kush', 0, 0),
  ('Akash', 'Sahith', 0, 1),
  ('Akash', 'Santosh', 1, 0),
  ('Akash', 'Vamsi', 0, 1),
  ('Jasti', 'Krishna', 0, 2),
  ('Jasti', 'Krithik', 1, 1),
  ('Jasti', 'Kush', 1, 0),
  ('Jasti', 'Sahith', 2, 0),
  ('Jasti', 'Santosh', 1, 1),
  ('Jasti', 'Vamsi', 1, 1),
  ('Krishna', 'Krithik', 1, 1),
  ('Krishna', 'Kush', 0, 1),
  ('Krishna', 'Sahith', 2, 0),
  ('Krishna', 'Santosh', 1, 1),
  ('Krishna', 'Vamsi', 2, 0),
  ('Krithik', 'Kush', 1, 0),
  ('Krithik', 'Sahith', 1, 1),
  ('Krithik', 'Santosh', 1, 1),
  ('Krithik', 'Vamsi', 2, 0),
  ('Kush', 'Sahith', 0, 1),
  ('Kush', 'Santosh', 1, 0),
  ('Kush', 'Vamsi', 0, 1),
  ('Sahith', 'Santosh', 0, 2),
  ('Sahith', 'Vamsi', 0, 2),
  ('Santosh', 'Vamsi', 1, 1);