import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: p } = await supabase.from('master_players').select('id, name, team').limit(50);
  console.log("SOME PLAYERS:", p?.map(x => x.name).slice(0, 10));

  const { data: matches } = await supabase.from('master_players').select('id, name, team').ilike('name', '%Gaikwad%');
  console.log("MATCHES:", matches);
}
main();
