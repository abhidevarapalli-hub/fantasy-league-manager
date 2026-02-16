import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let matchesChecked = 0;
  let matchesActivated = 0;
  const errors: string[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional lookahead from request body
    let lookaheadMinutes = 30;
    try {
      const body = await req.json();
      if (body?.lookahead_minutes && typeof body.lookahead_minutes === 'number') {
        lookaheadMinutes = body.lookahead_minutes;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    console.log(`[Lifecycle] Checking for matches to activate (lookahead: ${lookaheadMinutes}min)`);

    // Find matches approaching start time
    const { data: upcomingMatches, error: queryError } = await supabase
      .rpc('get_upcoming_matches_to_activate', {
        p_lookahead_minutes: lookaheadMinutes,
      });

    if (queryError) {
      throw new Error(`Failed to query upcoming matches: ${queryError.message}`);
    }

    matchesChecked = upcomingMatches?.length ?? 0;
    console.log(`[Lifecycle] Found ${matchesChecked} matches to activate`);

    if (!upcomingMatches || upcomingMatches.length === 0) {
      // Log the run even when nothing was activated
      await supabase.from('lifecycle_audit_log').insert({
        matches_activated: 0,
        matches_checked: 0,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No matches need activation',
          matchesChecked: 0,
          matchesActivated: 0,
          duration: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enable polling for each match
    const activatedMatches: Array<{ cricbuzz_match_id: number; match_description: string }> = [];

    for (const match of upcomingMatches) {
      try {
        const { data, error } = await supabase.rpc('enable_match_polling', {
          p_cricbuzz_match_id: match.cricbuzz_match_id,
          p_initial_state: 'Upcoming',
          p_auto: true,
        });

        if (error) {
          console.error(`[Lifecycle] Failed to enable polling for match ${match.cricbuzz_match_id}:`, error.message);
          errors.push(`Match ${match.cricbuzz_match_id}: ${error.message}`);
          continue;
        }

        console.log(`[Lifecycle] Activated polling for match ${match.cricbuzz_match_id} (${match.match_description})`);
        matchesActivated++;
        activatedMatches.push({
          cricbuzz_match_id: match.cricbuzz_match_id,
          match_description: match.match_description,
        });
      } catch (err) {
        const errMsg = (err as Error).message;
        console.error(`[Lifecycle] Error activating match ${match.cricbuzz_match_id}:`, errMsg);
        errors.push(`Match ${match.cricbuzz_match_id}: ${errMsg}`);
      }
    }

    // If any matches were activated, chain a call to poll-trigger for immediate first poll
    if (matchesActivated > 0) {
      try {
        console.log(`[Lifecycle] Chaining poll-trigger for ${matchesActivated} newly activated match(es)`);
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey;
        const pollResponse = await fetch(
          `${supabaseUrl}/functions/v1/poll-trigger`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({}),
          }
        );

        if (!pollResponse.ok) {
          const errBody = await pollResponse.text();
          console.error('[Lifecycle] poll-trigger chain call failed:', errBody);
          errors.push(`poll-trigger chain: ${errBody}`);
        } else {
          const pollResult = await pollResponse.json();
          console.log('[Lifecycle] poll-trigger chain result:', pollResult);
        }
      } catch (err) {
        console.error('[Lifecycle] Error chaining poll-trigger:', (err as Error).message);
        errors.push(`poll-trigger chain: ${(err as Error).message}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Insert audit log
    await supabase.from('lifecycle_audit_log').insert({
      matches_activated: matchesActivated,
      matches_checked: matchesChecked,
      errors: errors.length > 0 ? errors.join('; ') : null,
      duration_ms: durationMs,
    });

    return new Response(
      JSON.stringify({
        success: true,
        matchesChecked,
        matchesActivated,
        activatedMatches,
        errors: errors.length > 0 ? errors : undefined,
        duration: durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[Lifecycle] Fatal error:', (error as Error).message);

    // Try to log even on fatal error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from('lifecycle_audit_log').insert({
        matches_activated: matchesActivated,
        matches_checked: matchesChecked,
        errors: (error as Error).message,
        duration_ms: durationMs,
      });
    } catch {
      // Ignore audit log failures
    }

    return new Response(
      JSON.stringify({
        error: 'Lifecycle manager failed',
        details: (error as Error).message,
        matchesChecked,
        matchesActivated,
        duration: durationMs,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
