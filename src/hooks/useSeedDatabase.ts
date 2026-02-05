import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isInternationalPlayer } from "@/lib/international-players";
import { fetchAllTournamentPlayers, isApiConfigured } from "@/integrations/cricbuzz/client";
import { mapApiRole, getTeamCode, isInternationalForT20WC } from "@/lib/player-utils";
import { getTournamentById } from "@/lib/tournaments";

// Timeout wrapper for async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

// Initial data
const PLAYERS_DATA = [
  // Mumbai Indians
  { name: "Jasprit Bumrah", team: "MI", role: "Bowler" },
  { name: "Suryakumar Yadav", team: "MI", role: "Batsman" },
  { name: "Hardik Pandya", team: "MI", role: "All Rounder" },
  { name: "Tilak Varma", team: "MI", role: "Batsman" },
  { name: "Rohit Sharma", team: "MI", role: "Batsman" },
  { name: "Trent Boult", team: "MI", role: "Bowler" },
  { name: "Mitchell Santner", team: "MI", role: "All Rounder" },
  { name: "Naman Dhir", team: "MI", role: "All Rounder" },
  { name: "Ryan Rickelton", team: "MI", role: "Wicket Keeper" },
  { name: "Deepak Chahar", team: "MI", role: "Bowler" },
  { name: "Will Jacks", team: "MI", role: "All Rounder" },
  { name: "Quinton de Kock", team: "MI", role: "Wicket Keeper" },
  { name: "Shardul Thakur", team: "MI", role: "All Rounder" },
  { name: "Sherfane Rutherford", team: "MI", role: "All Rounder" },
  { name: "Corbin Bosch", team: "MI", role: "All Rounder" },
  { name: "Ashwani Kumar", team: "MI", role: "Bowler" },
  { name: "Mayank Markande", team: "MI", role: "Bowler" },
  { name: "Robin Minz", team: "MI", role: "Wicket Keeper" },
  { name: "Allah Ghazanfar", team: "MI", role: "Bowler" },
  { name: "Raj Angad Bawa", team: "MI", role: "All Rounder" },
  { name: "Raghu Sharma", team: "MI", role: "Bowler" },
  { name: "Danish Malewar", team: "MI", role: "Batsman" },
  { name: "Mohammed Izhar", team: "MI", role: "Bowler" },
  { name: "Mayank Rawat", team: "MI", role: "All Rounder" },
  { name: "Atharva Ankolekar", team: "MI", role: "All Rounder" },
  // Kolkata Knight Riders
  { name: "Sunil Narine", team: "KKR", role: "All Rounder" },
  { name: "Cameron Green", team: "KKR", role: "All Rounder" },
  { name: "Varun Chakravarthy", team: "KKR", role: "Bowler" },
  { name: "Ajinkya Rahane", team: "KKR", role: "Batsman" },
  { name: "Harshit Rana", team: "KKR", role: "Bowler" },
  { name: "Matheesha Pathirana", team: "KKR", role: "Bowler" },
  { name: "Rinku Singh", team: "KKR", role: "Batsman" },
  { name: "Ramandeep Singh", team: "KKR", role: "All Rounder" },
  { name: "Mustafizur Rahman", team: "KKR", role: "Bowler" },
  { name: "Rahul Tripathi", team: "KKR", role: "Batsman" },
  { name: "Angkrish Raghuvanshi", team: "KKR", role: "Batsman" },
  { name: "Vaibhav Arora", team: "KKR", role: "Bowler" },
  { name: "Akash Deep", team: "KKR", role: "Bowler" },
  { name: "Rachin Ravindra", team: "KKR", role: "All Rounder" },
  { name: "Tim Seifert", team: "KKR", role: "Wicket Keeper" },
  { name: "Rovman Powell", team: "KKR", role: "Batsman" },
  { name: "Umran Malik", team: "KKR", role: "Bowler" },
  { name: "Finn Allen", team: "KKR", role: "Wicket Keeper" },
  { name: "Kartik Tyagi", team: "KKR", role: "Bowler" },
  { name: "Prashant Solanki", team: "KKR", role: "Bowler" },
  { name: "Manish Pandey", team: "KKR", role: "Batsman" },
  { name: "Anukul Roy", team: "KKR", role: "All Rounder" },
  { name: "Daksh Kamra", team: "KKR", role: "All Rounder" },
  { name: "Sarthak Ranjan", team: "KKR", role: "Batsman" },
  { name: "Tejasvi Dahiya", team: "KKR", role: "Wicket Keeper" },
  // Chennai Super Kings
  { name: "Sanju Samson", team: "CSK", role: "Wicket Keeper" },
  { name: "Ruturaj Gaikwad", team: "CSK", role: "Batsman" },
  { name: "Noor Ahmad", team: "CSK", role: "Bowler" },
  { name: "Shivam Dube", team: "CSK", role: "All Rounder" },
  { name: "Dewald Brevis", team: "CSK", role: "Batsman" },
  { name: "Ayush Mhatre", team: "CSK", role: "Batsman" },
  { name: "Khaleel Ahmed", team: "CSK", role: "Bowler" },
  { name: "Anshul Kamboj", team: "CSK", role: "Bowler" },
  { name: "Prasanth Veer", team: "CSK", role: "All Rounder" },
  { name: "Kartik Sharma", team: "CSK", role: "Batsman" },
  { name: "Urvil Patel", team: "CSK", role: "Wicket Keeper" },
  { name: "Nathan Ellis", team: "CSK", role: "Bowler" },
  { name: "MS Dhoni", team: "CSK", role: "Wicket Keeper" },
  { name: "Rahul Chahar", team: "CSK", role: "Bowler" },
  { name: "Matt Henry", team: "CSK", role: "Bowler" },
  { name: "Sarfaraz Khan", team: "CSK", role: "Batsman" },
  { name: "Akeal Hosein", team: "CSK", role: "Bowler" },
  { name: "Jamie Overton", team: "CSK", role: "All Rounder" },
  { name: "Mathew Short", team: "CSK", role: "Batsman" },
  { name: "Ramakrishna Ghosh", team: "CSK", role: "Bowler" },
  { name: "Gurjapneet Singh", team: "CSK", role: "Bowler" },
  { name: "Mukesh Choudhary", team: "CSK", role: "Bowler" },
  { name: "Shreyas Gopal", team: "CSK", role: "Bowler" },
  { name: "Aman Khan", team: "CSK", role: "All Rounder" },
  { name: "Zakary Foulkes", team: "CSK", role: "All Rounder" },
  // Rajasthan Royals
  { name: "Yashasvi Jaiswal", team: "RR", role: "Batsman" },
  { name: "Ravindra Jadeja", team: "RR", role: "All Rounder" },
  { name: "Vaibhav Suryavanshi", team: "RR", role: "Batsman" },
  { name: "Riyan Parag", team: "RR", role: "All Rounder" },
  { name: "Jofra Archer", team: "RR", role: "Bowler" },
  { name: "Dhruv Jurel", team: "RR", role: "Wicket Keeper" },
  { name: "Ravi Bishnoi", team: "RR", role: "Bowler" },
  { name: "Shimron Hetmyer", team: "RR", role: "Batsman" },
  { name: "Sandeep Sharma", team: "RR", role: "Bowler" },
  { name: "Sam Curran", team: "RR", role: "All Rounder" },
  { name: "Tushar Deshpande", team: "RR", role: "Bowler" },
  { name: "Shubham Dubey", team: "RR", role: "Batsman" },
  { name: "Vignesh Puthur", team: "RR", role: "Bowler" },
  { name: "Aman Rao Perala", team: "RR", role: "Batsman" },
  { name: "Lhuan-Dre Pretorious", team: "RR", role: "Wicket Keeper" },
  { name: "Donovan Ferreira", team: "RR", role: "Wicket Keeper" },
  { name: "Nandre Burger", team: "RR", role: "Bowler" },
  { name: "Kuldeep Sen", team: "RR", role: "Bowler" },
  { name: "Adam Milne", team: "RR", role: "Bowler" },
  { name: "Kwena Maphaka", team: "RR", role: "Bowler" },
  { name: "Yudhvir Singh", team: "RR", role: "All Rounder" },
  { name: "Sushant Mishra", team: "RR", role: "Bowler" },
  { name: "Yash Raj Punja", team: "RR", role: "Batsman" },
  { name: "Ravi Singh", team: "RR", role: "Bowler" },
  { name: "Brijesh Sharma", team: "RR", role: "Bowler" },
  // Royal Challengers Bangalore
  { name: "Virat Kohli", team: "RCB", role: "Batsman" },
  { name: "Phil Salt", team: "RCB", role: "Wicket Keeper" },
  { name: "Rajat Patidar", team: "RCB", role: "Batsman" },
  { name: "Josh Hazlewood", team: "RCB", role: "Bowler" },
  { name: "Bhuvneshwar Kumar", team: "RCB", role: "Bowler" },
  { name: "Venkatesh Iyer", team: "RCB", role: "All Rounder" },
  { name: "Krunal Pandya", team: "RCB", role: "All Rounder" },
  { name: "Devdutt Padikkal", team: "RCB", role: "Batsman" },
  { name: "Jitesh Sharma", team: "RCB", role: "Wicket Keeper" },
  { name: "Yash Dayal", team: "RCB", role: "Bowler" },
  { name: "Suyash Sharma", team: "RCB", role: "Bowler" },
  { name: "Rasikh Dar", team: "RCB", role: "Bowler" },
  { name: "Tim David", team: "RCB", role: "Batsman" },
  { name: "Romario Shepherd", team: "RCB", role: "All Rounder" },
  { name: "Jacob Bethell", team: "RCB", role: "All Rounder" },
  { name: "Jacob Duffy", team: "RCB", role: "Bowler" },
  { name: "Nuwan Thushara", team: "RCB", role: "Bowler" },
  { name: "Mangesh Yadav", team: "RCB", role: "Bowler" },
  { name: "Swapnil Singh", team: "RCB", role: "All Rounder" },
  { name: "Abhinandan Singh", team: "RCB", role: "Bowler" },
  { name: "Satvik Deswal", team: "RCB", role: "Bowler" },
  { name: "Jordan Cox", team: "RCB", role: "Wicket Keeper" },
  { name: "Vicky Ostwal", team: "RCB", role: "Bowler" },
  { name: "Vihaan Malhotra", team: "RCB", role: "Batsman" },
  { name: "Kanishk Chouhan", team: "RCB", role: "All Rounder" },
  // Delhi Capitals
  { name: "KL Rahul", team: "DC", role: "Wicket Keeper" },
  { name: "Axar Patel", team: "DC", role: "All Rounder" },
  { name: "Kuldeep Yadav", team: "DC", role: "Bowler" },
  { name: "Mitchell Starc", team: "DC", role: "Bowler" },
  { name: "Tristan Stubbs", team: "DC", role: "Wicket Keeper" },
  { name: "Nitish Rana", team: "DC", role: "Batsman" },
  { name: "Ashutosh Sharma", team: "DC", role: "Batsman" },
  { name: "Vipraj Nigam", team: "DC", role: "Bowler" },
  { name: "David Miller", team: "DC", role: "Batsman" },
  { name: "T Natarajan", team: "DC", role: "Bowler" },
  { name: "Prithvi Shaw", team: "DC", role: "Batsman" },
  { name: "Abishek Porel", team: "DC", role: "Wicket Keeper" },
  { name: "Auqib Nabi Dar", team: "DC", role: "All Rounder" },
  { name: "Sameer Rizvi", team: "DC", role: "Batsman" },
  { name: "Karun Nair", team: "DC", role: "Batsman" },
  { name: "Mukesh Kumar", team: "DC", role: "Bowler" },
  { name: "Pathum Nissanka", team: "DC", role: "Batsman" },
  { name: "Kyle Jamieson", team: "DC", role: "All Rounder" },
  { name: "Dushmantha Chameera", team: "DC", role: "Bowler" },
  { name: "Lungi Ngidi", team: "DC", role: "Bowler" },
  { name: "Ben Duckett", team: "DC", role: "Wicket Keeper" },
  { name: "Ajay Mandal", team: "DC", role: "All Rounder" },
  { name: "Madhav Tiwari", team: "DC", role: "All Rounder" },
  { name: "Tripurana Vijay", team: "DC", role: "Bowler" },
  { name: "Sahil Parekh", team: "DC", role: "Bowler" },
  // Gujarat Titans
  { name: "Shubman Gill", team: "GT", role: "Batsman" },
  { name: "Sai Sudharsan", team: "GT", role: "Batsman" },
  { name: "Jos Buttler", team: "GT", role: "Wicket Keeper" },
  { name: "Rashid Khan", team: "GT", role: "All Rounder" },
  { name: "Mohammed Siraj", team: "GT", role: "Bowler" },
  { name: "Prasidh Krishna", team: "GT", role: "Bowler" },
  { name: "Kagiso Rabada", team: "GT", role: "Bowler" },
  { name: "Sai Kishore", team: "GT", role: "Bowler" },
  { name: "Washington Sundar", team: "GT", role: "All Rounder" },
  { name: "Glenn Phillips", team: "GT", role: "Wicket Keeper" },
  { name: "Rahul Tewatia", team: "GT", role: "All Rounder" },
  { name: "Jason Holder", team: "GT", role: "All Rounder" },
  { name: "Ishant Sharma", team: "GT", role: "Bowler" },
  { name: "Arshad Khan", team: "GT", role: "All Rounder" },
  { name: "Ashok Sharma", team: "GT", role: "Bowler" },
  { name: "Manav Suthar", team: "GT", role: "Bowler" },
  { name: "Shahrukh Khan", team: "GT", role: "Batsman" },
  { name: "Kumar Kushagra", team: "GT", role: "Wicket Keeper" },
  { name: "Nishant Sindhu", team: "GT", role: "All Rounder" },
  { name: "Gurnoor Brar", team: "GT", role: "Bowler" },
  { name: "Jayant Yadav", team: "GT", role: "All Rounder" },
  { name: "Anuj Rawat", team: "GT", role: "Wicket Keeper" },
  { name: "Tom Banton", team: "GT", role: "Wicket Keeper" },
  { name: "Prithvi Raj Yarra", team: "GT", role: "Bowler" },
  { name: "Luke Wood", team: "GT", role: "Bowler" },
  // Lucknow Super Giants
  { name: "Rishabh Pant", team: "LSG", role: "Wicket Keeper" },
  { name: "Nicholas Pooran", team: "LSG", role: "Wicket Keeper" },
  { name: "Mitchell Marsh", team: "LSG", role: "All Rounder" },
  { name: "Aiden Markram", team: "LSG", role: "Batsman" },
  { name: "Mohammed Shami", team: "LSG", role: "Bowler" },
  { name: "Ayush Badoni", team: "LSG", role: "Batsman" },
  { name: "Avesh Khan", team: "LSG", role: "Bowler" },
  { name: "Digvesh Singh Rathi", team: "LSG", role: "Bowler" },
  { name: "Abdul Samad", team: "LSG", role: "Batsman" },
  { name: "Shahbaz Ahmed", team: "LSG", role: "All Rounder" },
  { name: "Wanindu Hasaranga", team: "LSG", role: "All Rounder" },
  { name: "Anrich Nortje", team: "LSG", role: "Bowler" },
  { name: "Mayank Yadav", team: "LSG", role: "Bowler" },
  { name: "Mohsin Khan", team: "LSG", role: "Bowler" },
  { name: "Matthew Breetzke", team: "LSG", role: "Wicket Keeper" },
  { name: "Mukul Choudhary", team: "LSG", role: "Bowler" },
  { name: "Akash Singh", team: "LSG", role: "Bowler" },
  { name: "Arjun Tendulkar", team: "LSG", role: "All Rounder" },
  { name: "Naman Tiwari", team: "LSG", role: "Bowler" },
  { name: "Himmat Singh", team: "LSG", role: "Batsman" },
  { name: "Arshin Kulkarni", team: "LSG", role: "All Rounder" },
  { name: "M Siddharth", team: "LSG", role: "Bowler" },
  { name: "Prince Yadav", team: "LSG", role: "All Rounder" },
  { name: "Akshat Raghuwanshi", team: "LSG", role: "Batsman" },
  { name: "Josh Inglis", team: "LSG", role: "Wicket Keeper" },
  // Punjab Kings
  { name: "Shreyas Iyer", team: "PBKS", role: "Batsman" },
  { name: "Yuzvendra Chahal", team: "PBKS", role: "Bowler" },
  { name: "Arshdeep Singh", team: "PBKS", role: "Bowler" },
  { name: "Priyansh Arya", team: "PBKS", role: "Batsman" },
  { name: "Marco Jansen", team: "PBKS", role: "All Rounder" },
  { name: "Prabhsimran Singh", team: "PBKS", role: "Wicket Keeper" },
  { name: "Marcus Stoinis", team: "PBKS", role: "All Rounder" },
  { name: "Shashank Singh", team: "PBKS", role: "Batsman" },
  { name: "Lockie Ferguson", team: "PBKS", role: "Bowler" },
  { name: "Mitch Owen", team: "PBKS", role: "All Rounder" },
  { name: "Nehal Wadhera", team: "PBKS", role: "Batsman" },
  { name: "Harpreet Brar", team: "PBKS", role: "All Rounder" },
  { name: "Azmatullah Omarzai", team: "PBKS", role: "All Rounder" },
  { name: "Yash Thakur", team: "PBKS", role: "Bowler" },
  { name: "Vyshak Vijaykumar", team: "PBKS", role: "Bowler" },
  { name: "Vishnu Vinod", team: "PBKS", role: "Wicket Keeper" },
  { name: "Xavier Bartlett", team: "PBKS", role: "Bowler" },
  { name: "Cooper Connolly", team: "PBKS", role: "All Rounder" },
  { name: "Pyla Avinash", team: "PBKS", role: "Wicket Keeper" },
  { name: "Harnoor Pannu", team: "PBKS", role: "Batsman" },
  { name: "Suryansh Shedge", team: "PBKS", role: "All Rounder" },
  { name: "Ben Dwarshuis", team: "PBKS", role: "Bowler" },
  { name: "Musheer Khan", team: "PBKS", role: "All Rounder" },
  { name: "Vishal Nishad", team: "PBKS", role: "All Rounder" },
  { name: "Praveen Dubey", team: "PBKS", role: "Bowler" },
  // Sunrisers Hyderabad
  { name: "Abhishek Sharma", team: "SRH", role: "All Rounder" },
  { name: "Travis Head", team: "SRH", role: "Batsman" },
  { name: "Ishan Kishan", team: "SRH", role: "Wicket Keeper" },
  { name: "Heinrich Klaasen", team: "SRH", role: "Wicket Keeper" },
  { name: "Pat Cummins", team: "SRH", role: "Bowler" },
  { name: "Harshal Patel", team: "SRH", role: "Bowler" },
  { name: "Nitish Kumar Reddy", team: "SRH", role: "All Rounder" },
  { name: "Liam Livingstone", team: "SRH", role: "All Rounder" },
  { name: "Aniket Varma", team: "SRH", role: "Batsman" },
  { name: "Jaydev Unadkat", team: "SRH", role: "Bowler" },
  { name: "Harsh Dubey", team: "SRH", role: "All Rounder" },
  { name: "Smaran Ravichandran", team: "SRH", role: "Batsman" },
  { name: "Salil Arora", team: "SRH", role: "Wicket Keeper" },
  { name: "Zeeshan Ansari", team: "SRH", role: "Bowler" },
  { name: "Shivam Mavi", team: "SRH", role: "Bowler" },
  { name: "Echan Malinga", team: "SRH", role: "Bowler" },
  { name: "Brydon Carse", team: "SRH", role: "All Rounder" },
  { name: "Shivang Kumar", team: "SRH", role: "Batsman" },
  { name: "Kamindu Mendis", team: "SRH", role: "All Rounder" },
  { name: "Sakib Hussain", team: "SRH", role: "Bowler" },
  { name: "Onkar Tarmale", team: "SRH", role: "Bowler" },
  { name: "Amit Kumar", team: "SRH", role: "All Rounder" },
  { name: "Praful Hinge", team: "SRH", role: "Bowler" },
  { name: "Krains Fuletra", team: "SRH", role: "Bowler" },
  { name: "Jack Edwards", team: "SRH", role: "All Rounder" },
];


export const useSeedDatabase = () => {

  const [seeding, setSeeding] = useState(false);

  const seedDatabase = useCallback(async (leagueId?: string) => {
    if (!leagueId) return false;

    const seedStartTime = performance.now();
    // console.log(`[useSeedDatabase] 🌱 seedDatabase started for league: ${leagueId}`);

    setSeeding(true);
    try {
      // Check if data already exists for this league (check league_player_pool instead of players)
      const checkStartTime = performance.now();
      const { data: existingPoolEntries } = await supabase.from("league_player_pool").select("id").eq("league_id", leagueId).limit(1);
      const { data: existingManagers } = await supabase.from("managers").select("id").eq("league_id", leagueId).limit(1);
      const checkDuration = performance.now() - checkStartTime;
      // console.log(`[useSeedDatabase] 🔍 Existence check completed in ${checkDuration.toFixed(2)}ms`);

      const hasPlayers = (existingPoolEntries?.length ?? 0) > 0;
      const hasManagers = (existingManagers?.length ?? 0) > 0;

      if (hasPlayers && hasManagers) {
        // console.log(`[useSeedDatabase] ✅ League ${leagueId} already seeded (skipping), total time: ${(performance.now() - seedStartTime).toFixed(2)}ms`);
        return true;
      }

      // Seed players using new schema: master_players + league_player_pool
      if (!hasPlayers) {
        const insertStartTime = performance.now();
        console.log(`[useSeedDatabase] 📥 Inserting ${PLAYERS_DATA.length} players to master_players...`);

        // For each player in hardcoded data:
        // 1. Upsert to master_players (dedupe by name + role)
        // 2. Insert to league_player_pool
        for (const player of PLAYERS_DATA) {
          // First, check if player already exists in master_players
          const { data: existingMaster } = await supabase
            .from("master_players")
            .select("id")
            .eq("name", player.name)
            .eq("primary_role", player.role)
            .maybeSingle();

          let masterId: string;
          if (existingMaster) {
            masterId = existingMaster.id;
          } else {
            // Insert new master player
            const { data: newMaster, error: masterError } = await supabase
              .from("master_players")
              .insert({
                name: player.name,
                primary_role: player.role,
                is_international: isInternationalPlayer(player.name),
                teams: [player.team],
              })
              .select("id")
              .single();

            if (masterError || !newMaster) {
              console.error(`[useSeedDatabase] ❌ Error inserting master player ${player.name}:`, masterError);
              continue;
            }
            masterId = newMaster.id;
          }

          // Add to league player pool
          const { error: poolError } = await supabase
            .from("league_player_pool")
            .upsert({
              league_id: leagueId,
              player_id: masterId,
              team_override: player.team,
            }, { onConflict: 'league_id,player_id' });

          if (poolError) {
            console.error(`[useSeedDatabase] ❌ Error adding ${player.name} to league pool:`, poolError);
          }
        }

        const insertDuration = performance.now() - insertStartTime;
        console.log(`[useSeedDatabase] ✅ Players seeded successfully for league ${leagueId} in ${insertDuration.toFixed(2)}ms`);
      } else {
        console.log(`[useSeedDatabase] ✅ Players already exist, skipping insert`);
      }

      const totalSeedDuration = performance.now() - seedStartTime;
      console.log(`[useSeedDatabase] 🎉 seedDatabase completed in ${totalSeedDuration.toFixed(2)}ms`);
      return true;

    } catch (error) {
      console.error(`[useSeedDatabase] ❌ Error seeding database (${(performance.now() - seedStartTime).toFixed(2)}ms):`, error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, []);

  const reseedPlayers = useCallback(async (leagueId?: string) => {
    if (!leagueId) return false;
    setSeeding(true);
    try {
      // First, clear all manager rosters for this league (from junction table)
      const { error: clearRostersError } = await supabase
        .from("manager_roster" as any)
        .delete()
        .eq("league_id", leagueId);

      if (clearRostersError) {
        console.error("Error clearing rosters:", clearRostersError);
        throw clearRostersError;
      }

      // Delete all existing league_player_pool entries for this league
      const { error: deleteError } = await supabase
        .from("league_player_pool")
        .delete()
        .eq("league_id", leagueId);

      if (deleteError) {
        console.error("Error deleting league player pool:", deleteError);
        throw deleteError;
      }

      // Insert new players using master_players + league_player_pool
      for (const player of PLAYERS_DATA) {
        // Check if player exists in master_players
        const { data: existingMaster } = await supabase
          .from("master_players")
          .select("id")
          .eq("name", player.name)
          .eq("primary_role", player.role)
          .maybeSingle();

        let masterId: string;
        if (existingMaster) {
          masterId = existingMaster.id;
        } else {
          // Insert new master player
          const { data: newMaster, error: masterError } = await supabase
            .from("master_players")
            .insert({
              name: player.name,
              primary_role: player.role,
              is_international: isInternationalPlayer(player.name),
              teams: [player.team],
            })
            .select("id")
            .single();

          if (masterError || !newMaster) {
            console.error(`Error inserting master player ${player.name}:`, masterError);
            continue;
          }
          masterId = newMaster.id;
        }

        // Add to league player pool
        await supabase
          .from("league_player_pool")
          .insert({
            league_id: leagueId,
            player_id: masterId,
            team_override: player.team,
          });
      }

      console.log("Players reseeded successfully for league", leagueId);
      return true;
    } catch (error) {
      console.error("Error reseeding players:", error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, []);

  /**
   * Seed players from a tournament (T20 WC or IPL) via Cricbuzz API
   * Falls back to hardcoded IPL data if API fails
   */
  const seedFromTournament = useCallback(async (leagueId: string, tournamentId: number): Promise<boolean> => {
    setSeeding(true);
    try {
      // Check if players already exist in league_player_pool
      const { data: existingPoolEntries } = await supabase
        .from("league_player_pool")
        .select("id")
        .eq("league_id", leagueId)
        .limit(1);

      if ((existingPoolEntries?.length ?? 0) > 0) {
        console.log("[Seed] League already has players, skipping");
        return true;
      }

      // Check if API is configured
      if (!isApiConfigured()) {
        console.warn("[Seed] API not configured, using hardcoded data");
        return await seedDatabase(leagueId);
      }

      const tournament = getTournamentById(tournamentId);
      const isInternationalTournament = tournament?.type === 'international';

      console.log(`[Seed] Fetching from ${tournament?.shortName || tournamentId}...`);

      // Fetch all teams and players (with 60 second timeout)
      let teamsWithPlayers;
      try {
        teamsWithPlayers = await withTimeout(
          fetchAllTournamentPlayers(tournamentId),
          60000,
          `API timeout: Failed to fetch tournament data within 60 seconds`
        );
      } catch (apiError: any) {
        console.error("[Seed] API fetch failed:", apiError?.message || apiError);
        throw apiError;
      }

      console.log(`[Seed] Fetched ${teamsWithPlayers.length} teams`);

      // Check if we got any data
      if (!teamsWithPlayers || teamsWithPlayers.length === 0) {
        console.warn("[useSeedDatabase] ⚠️ No teams returned from API, falling back to hardcoded data");
        return await seedDatabase(leagueId);
      }

      // Transform API data and insert into master_players + league_player_pool
      console.log(`[useSeedDatabase] 📥 Processing ${teamsWithPlayers.length} teams...`);
      const insertStartTime = performance.now();

      let playersInserted = 0;
      let playersLinked = 0;

      for (const { team, players } of teamsWithPlayers) {
        const teamCode = getTeamCode(team.teamName);
        console.log(`[useSeedDatabase] 📋 Processing team: ${team.teamName} (${teamCode}) with ${players.length} players`);

        for (const player of players) {
          // Determine if player is international
          let isIntl: boolean;
          if (isInternationalTournament) {
            // For T20 WC: non-India players are international
            isIntl = isInternationalForT20WC(team.teamName);
          } else {
            // For IPL: use the existing international player check
            isIntl = isInternationalPlayer(player.name);
          }

          const role = mapApiRole(player.role);

          // Upsert to master_players using cricbuzz_id as unique key
          let masterId: string | null = null;

          if (player.id) {
            // Try to find existing master player by cricbuzz_id
            const { data: existingByApi } = await supabase
              .from("master_players")
              .select("id")
              .eq("cricbuzz_id", player.id)
              .maybeSingle();

            if (existingByApi) {
              masterId = existingByApi.id;
            } else {
              // Insert new master player with cricbuzz data
              const { data: newMaster, error: insertErr } = await supabase
                .from("master_players")
                .insert({
                  cricbuzz_id: player.id,
                  name: player.name,
                  primary_role: role,
                  is_international: isIntl,
                  image_id: player.imageId || null,
                  batting_style: player.battingStyle || null,
                  bowling_style: player.bowlingStyle || null,
                  teams: [teamCode],
                })
                .select("id")
                .single();

              if (insertErr) {
                console.warn(`[useSeedDatabase] ⚠️ Error inserting master player ${player.name}:`, insertErr);
                continue;
              }
              masterId = newMaster?.id || null;
              playersInserted++;
            }
          } else {
            // No cricbuzz_id, fallback to name+role matching
            const { data: existingByName } = await supabase
              .from("master_players")
              .select("id")
              .eq("name", player.name)
              .eq("primary_role", role)
              .maybeSingle();

            if (existingByName) {
              masterId = existingByName.id;
            } else {
              // Insert new master player without cricbuzz data
              const { data: newMaster, error: insertErr } = await supabase
                .from("master_players")
                .insert({
                  name: player.name,
                  primary_role: role,
                  is_international: isIntl,
                  teams: [teamCode],
                })
                .select("id")
                .single();

              if (insertErr) {
                console.warn(`[useSeedDatabase] ⚠️ Error inserting master player ${player.name}:`, insertErr);
                continue;
              }
              masterId = newMaster?.id || null;
              playersInserted++;
            }
          }

          // Link player to league via league_player_pool
          if (masterId) {
            const { error: poolError } = await supabase
              .from("league_player_pool")
              .upsert({
                league_id: leagueId,
                player_id: masterId,
                team_override: teamCode,
              }, { onConflict: 'league_id,player_id' });

            if (poolError) {
              console.warn(`[useSeedDatabase] ⚠️ Error linking ${player.name} to league:`, poolError);
            } else {
              playersLinked++;
            }
          }
        }
      }

      const insertDuration = performance.now() - insertStartTime;

      // Check if we linked any players
      if (playersLinked === 0) {
        console.warn("[useSeedDatabase] ⚠️ No players linked to league, falling back to hardcoded data");
        return await seedDatabase(leagueId);
      }

      console.log(`[useSeedDatabase] ✅ Inserted ${playersInserted} new master players, linked ${playersLinked} to league in ${insertDuration.toFixed(2)}ms`);
      console.log(`[Seed] Completed - ${playersLinked} players from ${tournament?.shortName || tournamentId}`);
      return true;

    } catch (error: any) {
      console.error(`[useSeedDatabase] ❌ Error seeding from tournament:`, error?.message || error);
      console.error(`[useSeedDatabase] Stack:`, error?.stack);
      // Fall back to hardcoded data on any error
      console.log("[useSeedDatabase] 🔄 Falling back to hardcoded IPL data...");
      return await seedDatabase(leagueId);
    } finally {
      setSeeding(false);
    }
  }, [seedDatabase]);

  /**
   * Reseed players from a tournament (T20 WC or IPL) via Cricbuzz API
   * This clears existing league_player_pool entries and fetches fresh data from the API
   * Note: master_players entries are NOT deleted as they may be shared across leagues
   */
  const reseedFromTournament = useCallback(async (leagueId: string, tournamentId: number): Promise<boolean> => {
    console.log(`[Reseed] Starting for tournament ${tournamentId}...`);

    setSeeding(true);
    try {
      // Clear all manager rosters for this league (from junction table)
      const { error: clearRostersError } = await supabase
        .from("manager_roster" as any)
        .delete()
        .eq("league_id", leagueId);

      if (clearRostersError) {
        console.error("[Reseed] Error clearing rosters:", clearRostersError);
        throw clearRostersError;
      }

      // Delete all league_player_pool entries for this league
      // Note: We don't delete master_players as they may be shared across leagues
      const { error: deleteError } = await supabase
        .from("league_player_pool")
        .delete()
        .eq("league_id", leagueId);

      if (deleteError) {
        console.error("[Reseed] Error deleting league player pool:", deleteError);
        throw deleteError;
      }

      // Seed from tournament (will create new master_players as needed and link to league)
      const result = await seedFromTournament(leagueId, tournamentId);

      if (result) {
        // Update the league's tournament_id in the database
        const { error: updateError } = await supabase
          .from("leagues")
          .update({ tournament_id: tournamentId })
          .eq("id", leagueId);

        if (updateError) {
          console.warn("[Reseed] Warning: Failed to update tournament_id:", updateError);
        } else {
          console.log(`[Reseed] Updated league tournament_id to ${tournamentId}`);
        }
      }

      console.log(`[Reseed] Completed - Success: ${result}`);
      return result;
    } catch (error) {
      console.error("[Reseed] Failed:", error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, [seedFromTournament]);

  return { seedDatabase, reseedPlayers, seedFromTournament, reseedFromTournament, seeding };
};
