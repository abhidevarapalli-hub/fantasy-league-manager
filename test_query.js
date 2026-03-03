import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const { data: picks, error: picksError } = await supabase.from('draft_picks').select('round, pick_number, manager_id, player_id').order('created_at', { ascending: false }).limit(20);
    console.log("LAST PICKS ERROR:", picksError);
    console.log("LAST PICKS:", JSON.stringify(picks, null, 2));

    // Find Gaikwad
    const { data: p } = await supabase.from('master_players').select('*').ilike('name', '%Gaik%').limit(5);
    console.log("GAIKWAD RECS:", p?.map(x => x.name));

    if (p && p.length > 0) {
        const { data: m } = await supabase.from('manager_roster').select('*').eq('player_id', p[0].id).order('week');
        console.log("GAIKWAD ROSTER LENGTH:", m?.length);
        console.log("GAIKWAD ROSTER SAMPLE:", m?.slice(0, 2));

        // Which manager drafted him?
        const { data: dp } = await supabase.from('draft_picks').select('*').eq('player_id', p[0].id);
        console.log("GAIKWAD DRAFT PICK:", JSON.stringify(dp, null, 2));

        if (dp && dp.length > 0) {
            const managerId = dp[0].manager_id;
            const { data: allRoster } = await supabase.from('manager_roster').select('player_id, week, slot_type, position').eq('manager_id', managerId).eq('week', 1);
            console.log(`ALL WK 1 ROSTER FOR GAIKWAD'S MANAGER:`, allRoster?.length, "records");

            const bench = allRoster?.filter(r => r.slot_type === 'bench');
            console.log(`BENCH:`, bench?.length);

            console.log("ALL WK 1 ROSTER TYPES:");
            for (const r of allRoster) {
                console.log(`- ${r.slot_type} (pos: ${r.position})`);
            }
        }
    }
}
main();
