import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:54323',
  // TODO: Add production domain before deploying
];

function getCorsHeaders(origin: string): Record<string, string> {
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin') || '');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
