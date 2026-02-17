-- Enable REPLICA IDENTITY FULL for transactions table
-- This ensures that Supabase Realtime can correctly filter and return full row data
-- for all event types, helping with reliability of real-time subscriptions.

ALTER TABLE public.transactions REPLICA IDENTITY FULL;
