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

  // --- Authorization check ---
  // Allow internal service-to-service calls (e.g., from match-lifecycle-manager) to bypass user JWT validation
  const isInternalCall = req.headers.get('x-supabase-service') === 'internal';

  if (!isInternalCall) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the JWT by creating a user-scoped client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOTE: League manager role verification could be added here in the future,
    // but JWT validation is the critical first step to prevent unauthenticated access.
  }
  // --- End authorization check ---

  const startTime = Date.now();
  const results: Array<{
    matchId: number;
    success: boolean;
    error?: string;
    duration?: number;
  }> = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Service-role client for database operations (unchanged — needed for elevated access)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get matches that need polling
    const { data: matchesToPoll, error: queryError } = await supabase
      .rpc('get_matches_to_poll');

    if (queryError) {
      throw new Error(`Failed to get matches: ${queryError.message}`);
    }

    if (!matchesToPoll || matchesToPoll.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No matches need polling',
          matchesPolled: 0,
          duration: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${matchesToPoll.length} matches to poll`);

    // Process each match
    for (const match of matchesToPoll) {
      const matchStartTime = Date.now();

      try {
        // Try to acquire lock
        const { data: lockAcquired, error: lockError } = await supabase
          .rpc('acquire_polling_lock', {
            p_cricbuzz_match_id: match.cricbuzz_match_id,
            p_lock_duration_seconds: 90,
          });

        if (lockError || !lockAcquired) {
          console.log(`Could not acquire lock for match ${match.cricbuzz_match_id}`);
          results.push({
            matchId: match.cricbuzz_match_id,
            success: false,
            error: 'Could not acquire lock',
          });
          continue;
        }

        // Call live-stats-poller
        const pollerResponse = await fetch(
          `${supabaseUrl}/functions/v1/live-stats-poller`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              cricbuzz_match_id: match.cricbuzz_match_id,
            }),
          }
        );

        const pollerResult = await pollerResponse.json();

        if (!pollerResponse.ok) {
          console.error(`Poller error for match ${match.cricbuzz_match_id}:`, pollerResult);
          results.push({
            matchId: match.cricbuzz_match_id,
            success: false,
            error: pollerResult.error || 'Poller failed',
            duration: Date.now() - matchStartTime,
          });
        } else {
          console.log(`Successfully polled match ${match.cricbuzz_match_id}:`, pollerResult);
          results.push({
            matchId: match.cricbuzz_match_id,
            success: true,
            duration: Date.now() - matchStartTime,
          });
        }

        // Lock is released by live-stats-poller on success/error
      } catch (error) {
        console.error(`Error polling match ${match.cricbuzz_match_id}:`, error);

        // Release lock on error
        await supabase.rpc('release_polling_lock', {
          p_cricbuzz_match_id: match.cricbuzz_match_id,
        });

        results.push({
          matchId: match.cricbuzz_match_id,
          success: false,
          error: error.message,
          duration: Date.now() - matchStartTime,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        matchesPolled: matchesToPoll.length,
        successCount,
        failedCount: matchesToPoll.length - successCount,
        results,
        duration: totalDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Poll trigger error:', error);
    return new Response(
      JSON.stringify({
        error: 'Poll trigger failed',
        details: error.message,
        results,
        duration: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
