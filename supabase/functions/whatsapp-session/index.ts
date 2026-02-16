import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { action, leagueId, groupId, groupName } = body;

    if (!leagueId) {
      return json({ error: 'Missing leagueId' }, 400);
    }

    // Verify the user is the league manager
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, league_manager_id, name')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      return json({ error: 'League not found' }, 404);
    }
    if (league.league_manager_id !== user.id) {
      return json({ error: 'Only the league manager can manage WhatsApp settings' }, 403);
    }

    const sessionName = `league-${leagueId}`;
    const wahaHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (wahaApiKey) {
      wahaHeaders['X-Api-Key'] = wahaApiKey;
    }

    switch (action) {
      case 'start': {
        // Start a new WAHA session
        const startRes = await fetch(`${wahaApiUrl}/api/sessions`, {
          method: 'POST',
          headers: wahaHeaders,
          body: JSON.stringify({ name: sessionName }),
        });

        if (!startRes.ok) {
          const err = await startRes.text();
          console.error('WAHA start session error:', err);
          return json({ error: 'Failed to start WhatsApp session' }, 502);
        }

        // Upsert config row
        await supabase
          .from('whatsapp_league_config')
          .upsert({
            league_id: leagueId,
            waha_session_name: sessionName,
            session_status: 'qr_pending',
            is_active: false,
            connected_by: user.id,
          }, { onConflict: 'league_id' });

        return json({ success: true, session: sessionName });
      }

      case 'qr': {
        // Get QR code screenshot for scanning
        const qrRes = await fetch(
          `${wahaApiUrl}/api/screenshot?session=${sessionName}`,
          { headers: wahaHeaders }
        );

        if (!qrRes.ok) {
          return json({ error: 'Failed to get QR code. Session may not be started.' }, 502);
        }

        const contentType = qrRes.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          const arrayBuffer = await qrRes.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          return json({ qr: `data:${contentType};base64,${base64}` });
        }

        // WAHA may return JSON with QR data
        const qrData = await qrRes.json();
        return json({ qr: qrData });
      }

      case 'status': {
        // Check current session status
        const statusRes = await fetch(
          `${wahaApiUrl}/api/sessions/${sessionName}`,
          { headers: wahaHeaders }
        );

        if (!statusRes.ok) {
          // Session doesn't exist
          await supabase
            .from('whatsapp_league_config')
            .update({ session_status: 'disconnected', is_active: false })
            .eq('league_id', leagueId);

          return json({ status: 'disconnected' });
        }

        const sessionInfo = await statusRes.json();
        const wahaStatus = sessionInfo.status || sessionInfo.engine?.status;

        let mappedStatus: string;
        if (wahaStatus === 'WORKING' || wahaStatus === 'CONNECTED') {
          mappedStatus = 'connected';
        } else if (wahaStatus === 'SCAN_QR_CODE' || wahaStatus === 'STARTING') {
          mappedStatus = 'qr_pending';
        } else {
          mappedStatus = 'disconnected';
        }

        await supabase
          .from('whatsapp_league_config')
          .update({ session_status: mappedStatus })
          .eq('league_id', leagueId);

        return json({ status: mappedStatus });
      }

      case 'groups': {
        // List WhatsApp groups the session belongs to
        const groupsRes = await fetch(
          `${wahaApiUrl}/api/${sessionName}/groups`,
          { headers: wahaHeaders }
        );

        if (!groupsRes.ok) {
          return json({ error: 'Failed to fetch groups. Is the session connected?' }, 502);
        }

        const groups = await groupsRes.json();
        return json({ groups });
      }

      case 'select-group': {
        // Link an existing WhatsApp group to the league
        if (!groupId || !groupName) {
          return json({ error: 'Missing groupId or groupName' }, 400);
        }

        await supabase
          .from('whatsapp_league_config')
          .update({
            whatsapp_group_id: groupId,
            whatsapp_group_name: groupName,
            is_active: true,
            session_status: 'connected',
            connected_by: user.id,
            connected_at: new Date().toISOString(),
          })
          .eq('league_id', leagueId);

        return json({ success: true, groupId, groupName });
      }

      case 'create-group': {
        // Create a new WhatsApp group
        const newGroupName = groupName || `${league.name} Fantasy League`;
        const createRes = await fetch(
          `${wahaApiUrl}/api/${sessionName}/groups`,
          {
            method: 'POST',
            headers: wahaHeaders,
            body: JSON.stringify({ name: newGroupName }),
          }
        );

        if (!createRes.ok) {
          const err = await createRes.text();
          console.error('WAHA create group error:', err);
          return json({ error: 'Failed to create WhatsApp group' }, 502);
        }

        const newGroup = await createRes.json();
        const newGroupId = newGroup.id || newGroup.gid?._serialized;

        // Get invite link
        let inviteLink: string | null = null;
        try {
          const inviteRes = await fetch(
            `${wahaApiUrl}/api/${sessionName}/groups/${newGroupId}/invite-code`,
            { headers: wahaHeaders }
          );
          if (inviteRes.ok) {
            const inviteData = await inviteRes.json();
            inviteLink = inviteData.link || inviteData.inviteCode
              ? `https://chat.whatsapp.com/${inviteData.inviteCode}`
              : null;
          }
        } catch (e) {
          console.error('Failed to get invite link:', e);
        }

        // Save config
        await supabase
          .from('whatsapp_league_config')
          .update({
            whatsapp_group_id: newGroupId,
            whatsapp_group_name: newGroupName,
            is_active: true,
            session_status: 'connected',
            connected_by: user.id,
            connected_at: new Date().toISOString(),
          })
          .eq('league_id', leagueId);

        return json({ success: true, groupId: newGroupId, groupName: newGroupName, inviteLink });
      }

      case 'disconnect': {
        // Stop the WAHA session and disconnect
        try {
          await fetch(`${wahaApiUrl}/api/sessions/${sessionName}`, {
            method: 'DELETE',
            headers: wahaHeaders,
          });
        } catch (e) {
          console.error('Failed to stop WAHA session:', e);
        }

        await supabase
          .from('whatsapp_league_config')
          .update({
            is_active: false,
            session_status: 'disconnected',
            whatsapp_group_id: null,
            whatsapp_group_name: null,
            connected_at: null,
          })
          .eq('league_id', leagueId);

        return json({ success: true });
      }

      case 'test': {
        // Send a test message to the linked WhatsApp group
        const { data: config } = await supabase
          .from('whatsapp_league_config')
          .select('*')
          .eq('league_id', leagueId)
          .single();

        if (!config?.whatsapp_group_id || !config.is_active) {
          return json({ error: 'WhatsApp is not connected for this league' }, 400);
        }

        const testMessage = `🏏 *${league.name}*\n\n✅ WhatsApp notifications are connected! You'll receive league transaction updates here.`;

        const sendRes = await fetch(`${wahaApiUrl}/api/sendText`, {
          method: 'POST',
          headers: wahaHeaders,
          body: JSON.stringify({
            chatId: config.whatsapp_group_id,
            text: testMessage,
            session: sessionName,
          }),
        });

        if (!sendRes.ok) {
          return json({ error: 'Failed to send test message' }, 502);
        }

        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('WhatsApp session error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
