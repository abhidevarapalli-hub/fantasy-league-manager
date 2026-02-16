import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransactionPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    type: string;
    league_id: string;
    manager_team_name?: string;
    description: string;
    players?: Array<{
      type: string;
      playerName: string;
      role: string;
      team: string;
    }>;
    week?: number;
  };
}

const EMOJI_MAP: Record<string, string> = {
  add: '➕',
  drop: '❌',
  trade: '🔄',
  score: '📊',
};

const NOTIFICATION_TOGGLE_MAP: Record<string, string> = {
  add: 'notify_player_add',
  drop: 'notify_player_drop',
  trade: 'notify_trade',
  score: 'notify_score_finalized',
};

function formatMessage(
  leagueName: string,
  transaction: TransactionPayload['record']
): string {
  const emoji = EMOJI_MAP[transaction.type] || '📋';
  return `${emoji} *${leagueName}*\n\n${transaction.description}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const wahaApiUrl = Deno.env.get('WAHA_API_URL') || 'http://localhost:3000';
    const wahaApiKey = Deno.env.get('WAHA_API_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TransactionPayload = await req.json();

    // Validate it's a transaction INSERT
    if (payload.type !== 'INSERT' || !payload.record) {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transaction = payload.record;
    const leagueId = transaction.league_id;

    if (!leagueId) {
      console.log('Transaction has no league_id, skipping WhatsApp notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'no league_id' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch WhatsApp config for this league
    const { data: config, error: configError } = await supabase
      .from('whatsapp_league_config')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    if (configError || !config) {
      console.log(`No WhatsApp config for league ${leagueId}, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'no config' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check master toggle
    if (!config.is_active || config.session_status !== 'connected') {
      console.log(`WhatsApp not active for league ${leagueId}, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: 'inactive' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this transaction type has notifications enabled
    const toggleColumn = NOTIFICATION_TOGGLE_MAP[transaction.type];
    if (toggleColumn && !config[toggleColumn]) {
      console.log(`Notifications disabled for ${transaction.type} in league ${leagueId}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'type_disabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch league name
    const { data: league } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', leagueId)
      .single();

    const leagueName = league?.name || 'Fantasy League';
    const message = formatMessage(leagueName, transaction);

    // Create pending log entry
    const { data: logEntry } = await supabase
      .from('whatsapp_notification_log')
      .insert({
        league_id: leagueId,
        transaction_id: transaction.id,
        message_body: message,
        status: 'pending',
      })
      .select('id')
      .single();

    // Send via WAHA
    const wahaHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (wahaApiKey) {
      wahaHeaders['X-Api-Key'] = wahaApiKey;
    }

    const sendRes = await fetch(`${wahaApiUrl}/api/sendText`, {
      method: 'POST',
      headers: wahaHeaders,
      body: JSON.stringify({
        chatId: config.whatsapp_group_id,
        text: message,
        session: config.waha_session_name,
      }),
    });

    if (sendRes.ok) {
      // Update log as sent
      if (logEntry?.id) {
        await supabase
          .from('whatsapp_notification_log')
          .update({ status: 'sent' })
          .eq('id', logEntry.id);
      }

      console.log(`WhatsApp notification sent for transaction ${transaction.id}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const errorText = await sendRes.text();
      console.error('WAHA send error:', errorText);

      // Update log as failed
      if (logEntry?.id) {
        await supabase
          .from('whatsapp_notification_log')
          .update({ status: 'failed', error_message: errorText.slice(0, 500) })
          .eq('id', logEntry.id);
      }

      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('WhatsApp notifier error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
