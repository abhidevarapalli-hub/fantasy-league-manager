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
    setSeeding(true);
    try {
      const { data: existingPoolEntries } = await supabase.from("league_player_pool").select("id").eq("league_id", leagueId).limit(1);
      if ((existingPoolEntries?.length ?? 0) > 0) return true;

      // Bulk insert hardcoded data
      const names = PLAYERS_DATA.map(p => p.name);
      const { data: existingMasters } = await supabase
        .from("master_players")
        .select("id, name, primary_role")
        .in("name", names);

      const existingMap = new Map(existingMasters?.map(p => [`${p.name}-${p.primary_role}`, p.id]) || []);

      const newMasters = [];
      const leaguePoolInserts = [];

      for (const p of PLAYERS_DATA) {
        const key = `${p.name}-${p.role}`;
        if (existingMap.has(key)) {
          leaguePoolInserts.push({
            league_id: leagueId,
            player_id: existingMap.get(key),
            team_override: p.team
          });
        } else {
          newMasters.push({
            name: p.name,
            primary_role: p.role,
            is_international: isInternationalPlayer(p.name),
            teams: [p.team]
          });
        }
      }

      if (newMasters.length > 0) {
        const { data: inserted } = await supabase.from("master_players").insert(newMasters).select();
        if (inserted) {
          inserted.forEach(m => {
            const original = PLAYERS_DATA.find(p => p.name === m.name && p.role === m.primary_role);
            if (original) {
              leaguePoolInserts.push({
                league_id: leagueId,
                player_id: m.id,
                team_override: original?.team
              });
            }
          });
        }
      }

      if (leaguePoolInserts.length > 0) {
        await supabase.from("league_player_pool").insert(leaguePoolInserts);
      }

      const totalSeedDuration = performance.now() - seedStartTime;
      console.log(`[useSeedDatabase] 🎉 seedDatabase completed in ${totalSeedDuration.toFixed(2)}ms`);
      return true;

    } catch (error) {
      console.error(`[useSeedDatabase] ❌ Error seeding database:`, error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, []);

  const reseedPlayers = useCallback(async (leagueId?: string) => {
    if (!leagueId) return false;
    setSeeding(true);
    try {
      await supabase.from("manager_roster").delete().eq("league_id", leagueId);
      await supabase.from("league_player_pool").delete().eq("league_id", leagueId);
      await seedDatabase(leagueId);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setSeeding(false);
    }
  }, [seedDatabase]);

  const seedFromTournament = useCallback(async (leagueId: string, tournamentId: number, forceRefresh = false): Promise<boolean> => {
    setSeeding(true);
    try {
      if (!forceRefresh) {
        const { count } = await supabase
          .from("league_player_pool")
          .select("*", { count: "exact", head: true })
          .eq("league_id", leagueId);

        if (count && count > 0) {
          console.log("[Seed] League already has players, skipping");
          return true;
        }
      }

      const tournament = getTournamentById(tournamentId);
      const isInternational = tournament?.type === 'international';

      const targetTeams = tournament?.teams || [];
      const testTeam = isInternational ? 'NAM' : 'CSK';
      // Fallback to testTeam if targetTeams is empty, though it shouldn't be for supported tournaments
      const teamsToCheck = targetTeams.length > 0 ? targetTeams : [testTeam];

      const { count: masterCount } = await supabase
        .from("master_players")
        .select("*", { count: "exact", head: true })
        .overlaps("teams", teamsToCheck);

      const hasLocalData = (masterCount || 0) > 10;

      if (hasLocalData && !forceRefresh) {
        console.log(`[Seed] found local data for ${teamsToCheck.join(',')} (${masterCount} players). Using local master_players.`);

        const targetTeams = tournament?.teams || [];

        if (targetTeams.length > 0) {
          const { data: localPlayers } = await supabase
            .from("master_players")
            .select("id, teams")
            .overlaps("teams", targetTeams);

          if (localPlayers && localPlayers.length > 200) {
            console.log(`[Seed] Found ${localPlayers.length} players locally. Linking to league...`);

            const poolInserts = localPlayers.map(p => {
              // Find which team matched (first match)
              const team = p.teams?.find((t: string) => targetTeams.includes(t)) || p.teams?.[0] || 'UNK';
              return {
                league_id: leagueId,
                player_id: p.id,
                team_override: team
              };
            });

            const chunkSize = 100;
            for (let i = 0; i < poolInserts.length; i += chunkSize) {
              const chunk = poolInserts.slice(i, i + chunkSize);
              const { error } = await supabase.from("league_player_pool").upsert(chunk, { onConflict: 'league_id,player_id' });
              if (error) console.error("Error linking chunk:", error);
            }
            return true;
          }
        }
      }

      if (!isApiConfigured()) {
        console.warn("[Seed] API not configured, using hardcoded data");
        return await seedDatabase(leagueId);
      }

      console.log(`[Seed] Fetching from ${tournament?.shortName || tournamentId}...`);

      let teamsWithPlayers;
      try {
        teamsWithPlayers = await withTimeout(
          fetchAllTournamentPlayers(tournamentId),
          60000,
          `API timeout`
        );
      } catch (apiError: unknown) {
        console.error("[Seed] API fetch failed:", apiError);
        return await seedDatabase(leagueId);
      }

      if (!teamsWithPlayers || teamsWithPlayers.length === 0) {
        return await seedDatabase(leagueId);
      }

      console.log(`[useSeedDatabase] 📥 Processing ${teamsWithPlayers.length} teams...`);

      // Flatten all players
      interface SeedPlayer {
        cricbuzz_id: string | null;
        name: string;
        primary_role: string;
        is_international: boolean;
        image_id: number | undefined;
        batting_style: string | undefined;
        bowling_style: string | undefined;
        teams: string[];
        team_code: string;
      }
      const allPlayers: SeedPlayer[] = [];

      for (const { team, players } of teamsWithPlayers) {
        const teamCode = getTeamCode(team.teamName);
        for (const player of players) {
          let isIntl: boolean;
          if (isInternational) {
            isIntl = isInternationalForT20WC(team.teamName);
          } else {
            isIntl = isInternationalPlayer(player.name);
          }
          const role = mapApiRole(player.role);

          allPlayers.push({
            cricbuzz_id: player.id ? String(player.id) : null,
            name: player.name,
            primary_role: role,
            is_international: isIntl,
            image_id: player.imageId,
            batting_style: player.battingStyle,
            bowling_style: player.bowlingStyle,
            teams: [teamCode],
            team_code: teamCode
          });
        }
      }

      const upsertChunkSize = 50;
      const leagueInserts = [];

      for (let i = 0; i < allPlayers.length; i += upsertChunkSize) {
        const chunk = allPlayers.slice(i, i + upsertChunkSize);

        // Only upsert players with cricbuzz_id
        const validPlayers = chunk.filter(p => p.cricbuzz_id);
        const validPayload = validPlayers.map(p => ({
          cricbuzz_id: p.cricbuzz_id,
          name: p.name,
          primary_role: p.primary_role,
          is_international: p.is_international,
          image_id: p.image_id,
          batting_style: p.batting_style,
          bowling_style: p.bowling_style,
          teams: p.teams,
        }));

        if (validPayload.length > 0) {
          const { data: upserted, error } = await supabase
            .from("master_players")
            .upsert(validPayload, { onConflict: 'cricbuzz_id' })
            .select("id, cricbuzz_id");

          if (error) {
            console.error("Error upserting chunk:", error);
          } else if (upserted) {
            upserted.forEach(m => {
              const original = chunk.find(c => c.cricbuzz_id == m.cricbuzz_id);
              if (original) {
                leagueInserts.push({
                  league_id: leagueId,
                  player_id: m.id,
                  team_override: original.team_code
                });
              }
            });
          }
        }

        // Handle players without cricbuzz_id (rare fallback)
        const noIdPlayers = chunk.filter(p => !p.cricbuzz_id);
        for (const p of noIdPlayers) {
          const { data: existing } = await supabase.from("master_players").select("id").eq("name", p.name).eq("primary_role", p.primary_role).maybeSingle();
          if (existing) {
            leagueInserts.push({ league_id: leagueId, player_id: existing.id, team_override: p.team_code });
          } else {
            const { data: newP } = await supabase.from("master_players").insert({
              name: p.name, primary_role: p.primary_role, is_international: p.is_international, teams: p.teams
            }).select("id").single();
            if (newP) leagueInserts.push({ league_id: leagueId, player_id: newP.id, team_override: p.team_code });
          }
        }
      }

      for (let i = 0; i < leagueInserts.length; i += 100) {
        const chunk = leagueInserts.slice(i, i + 100);
        const { error } = await supabase.from("league_player_pool").upsert(chunk, { onConflict: 'league_id,player_id' });
        if (error) console.error("Error linking pool:", error);
      }

      return true;

    } catch (error: unknown) {
      console.error(`[useSeedDatabase] ❌ Error seeding from tournament:`, error);
      return await seedDatabase(leagueId);
    } finally {
      setSeeding(false);
    }
  }, [seedDatabase]);

  const reseedFromTournament = useCallback(async (leagueId: string, tournamentId: number) => {
    setSeeding(true);
    try {
      await supabase.from("manager_roster").delete().eq("league_id", leagueId);
      await supabase.from("league_player_pool").delete().eq("league_id", leagueId);
      const result = await seedFromTournament(leagueId, tournamentId, true);

      if (result) {
        await supabase.from("leagues").update({ tournament_id: tournamentId }).eq("id", leagueId);
      }
      return result;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setSeeding(false);
    }
  }, [seedFromTournament]);

  return { seedDatabase, reseedPlayers, seedFromTournament, reseedFromTournament, seeding };
};
