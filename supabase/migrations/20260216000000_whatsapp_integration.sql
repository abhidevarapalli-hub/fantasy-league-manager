-- WhatsApp Group Integration
-- Adds tables for per-league WhatsApp group connections and notification audit logging.

-- Table: whatsapp_league_config
-- Per-league WhatsApp group connection and notification settings.
CREATE TABLE IF NOT EXISTS public.whatsapp_league_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL UNIQUE REFERENCES public.leagues(id) ON DELETE CASCADE,
  waha_session_name TEXT NOT NULL,
  whatsapp_group_id TEXT,
  whatsapp_group_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  session_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (session_status IN ('disconnected', 'qr_pending', 'connected')),
  notify_player_add BOOLEAN NOT NULL DEFAULT true,
  notify_player_drop BOOLEAN NOT NULL DEFAULT true,
  notify_trade BOOLEAN NOT NULL DEFAULT true,
  notify_score_finalized BOOLEAN NOT NULL DEFAULT true,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: whatsapp_notification_log
-- Audit trail for sent WhatsApp notifications.
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_whatsapp_league_config_league_id ON public.whatsapp_league_config(league_id);
CREATE INDEX idx_whatsapp_notification_log_league_id ON public.whatsapp_notification_log(league_id);
CREATE INDEX idx_whatsapp_notification_log_transaction_id ON public.whatsapp_notification_log(transaction_id);

-- Enable RLS
ALTER TABLE public.whatsapp_league_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_league_config

-- League members can view their league's WhatsApp config
CREATE POLICY "League members can view whatsapp config"
  ON public.whatsapp_league_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.managers m
      WHERE m.league_id = whatsapp_league_config.league_id
        AND m.user_id = auth.uid()
    )
  );

-- League managers can insert WhatsApp config for their league
CREATE POLICY "League managers can insert whatsapp config"
  ON public.whatsapp_league_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = whatsapp_league_config.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- League managers can update WhatsApp config for their league
CREATE POLICY "League managers can update whatsapp config"
  ON public.whatsapp_league_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = whatsapp_league_config.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_notification_log

-- League managers can view notification logs for their league
CREATE POLICY "League managers can view notification logs"
  ON public.whatsapp_notification_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = whatsapp_notification_log.league_id
        AND l.league_manager_id = auth.uid()
    )
  );

-- Edge functions (service role) can insert notification logs
CREATE POLICY "Service role can insert notification logs"
  ON public.whatsapp_notification_log
  FOR INSERT
  WITH CHECK (true);

-- updated_at trigger for whatsapp_league_config
CREATE OR REPLACE FUNCTION public.update_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_league_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_config_updated_at();
