-- Enable realtime for draft tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_order;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_state;