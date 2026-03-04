import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching draft picks...");
    const { data: picks, error: picksError } = await supabase.from('draft_picks').select('*').not('player_id', 'is', null);
    if (picksError) return console.error("Error fetching picks:", picksError);

    console.log(`Found ${picks.length} draft picks.`);

    if (picks.length === 0) {
        return console.log("No picks found to check.");
    }

    const leagueId = picks[0].league_id;

    console.log("Fetching manager rosters...");
    const { data: roster, error: rosterError } = await supabase.from('manager_roster').select('*').eq('league_id', leagueId);
    if (rosterError) return console.error("Error fetching roster:", rosterError);

    console.log(`Found ${roster.length} roster entries total.`);

    // Group picks by manager
    const picksByManager = {};
    for (const pick of picks) {
        if (!picksByManager[pick.manager_id]) picksByManager[pick.manager_id] = [];
        picksByManager[pick.manager_id].push(pick.player_id);
    }

    // Get distinct players in manager_roster
    const rosterPlayersSet = new Set(roster.map(r => r.player_id));

    const missingPlayers = [];
    for (const pick of picks) {
        if (!rosterPlayersSet.has(pick.player_id)) {
            missingPlayers.push(pick);
        }
    }

    console.log(`Found ${missingPlayers.length} missing players from roster.`);

    if (missingPlayers.length > 0) {
        // Get names of missing players
        const missingIds = missingPlayers.map(p => p.player_id);
        const { data: players } = await supabase.from('master_players').select('id, name, role').in('id', missingIds);

        const playerMap = {};
        if (players) {
            players.forEach(p => playerMap[p.id] = p);
        }

        console.log("Missing players details:");
        missingPlayers.slice(0, 10).forEach(pick => {
            console.log(`- Round ${pick.round}, Pick ${pick.pick_number}: ${playerMap[pick.player_id]?.name} (${playerMap[pick.player_id]?.role}) - Manager ID: ${pick.manager_id}`);
        });
        if (missingPlayers.length > 10) console.log(`...and ${missingPlayers.length - 10} more.`);
    } else {
        console.log("All drafted players are correctly in the manager_roster table!");
    }
}
main();
