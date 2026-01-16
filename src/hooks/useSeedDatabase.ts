import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Initial data
const PLAYERS_DATA = [
  // Mumbai Indians
  { name: 'Jasprit Bumrah', team: 'MI', role: 'Bowler' },
  { name: 'Suryakumar Yadav', team: 'MI', role: 'Batsman' },
  { name: 'Hardik Pandya', team: 'MI', role: 'All Rounder' },
  { name: 'Tilak Varma', team: 'MI', role: 'Batsman' },
  { name: 'Rohit Sharma', team: 'MI', role: 'Batsman' },
  { name: 'Trent Boult', team: 'MI', role: 'Bowler' },
  { name: 'Mitchell Santner', team: 'MI', role: 'All Rounder' },
  { name: 'Naman Dhir', team: 'MI', role: 'All Rounder' },
  { name: 'Ryan Rickelton', team: 'MI', role: 'Wicket Keeper' },
  { name: 'Deepak Chahar', team: 'MI', role: 'Bowler' },
  { name: 'Will Jacks', team: 'MI', role: 'All Rounder' },
  { name: 'Quinton de Kock', team: 'MI', role: 'Wicket Keeper' },
  { name: 'Shardul Thakur', team: 'MI', role: 'All Rounder' },
  // KKR
  { name: 'Sunil Narine', team: 'KKR', role: 'All Rounder' },
  { name: 'Cameron Green', team: 'KKR', role: 'All Rounder' },
  { name: 'Varun Chakravarthy', team: 'KKR', role: 'Bowler' },
  { name: 'Ajinkya Rahane', team: 'KKR', role: 'Batsman' },
  { name: 'Harshit Rana', team: 'KKR', role: 'Bowler' },
  { name: 'Rinku Singh', team: 'KKR', role: 'Batsman' },
  { name: 'Ramandeep Singh', team: 'KKR', role: 'All Rounder' },
  // CSK
  { name: 'Sanju Samson', team: 'CSK', role: 'Wicket Keeper' },
  { name: 'Ruturaj Gaikwad', team: 'CSK', role: 'Batsman' },
  { name: 'Shivam Dube', team: 'CSK', role: 'All Rounder' },
  { name: 'MS Dhoni', team: 'CSK', role: 'Wicket Keeper' },
  { name: 'Ravindra Jadeja', team: 'CSK', role: 'All Rounder' },
  // RR
  { name: 'Yashasvi Jaiswal', team: 'RR', role: 'Batsman' },
  { name: 'Riyan Parag', team: 'RR', role: 'All Rounder' },
  { name: 'Jofra Archer', team: 'RR', role: 'Bowler' },
  { name: 'Dhruv Jurel', team: 'RR', role: 'Wicket Keeper' },
  { name: 'Sam Curran', team: 'RR', role: 'All Rounder' },
  // RCB
  { name: 'Virat Kohli', team: 'RCB', role: 'Batsman' },
  { name: 'Phil Salt', team: 'RCB', role: 'Wicket Keeper' },
  { name: 'Rajat Patidar', team: 'RCB', role: 'Batsman' },
  { name: 'Josh Hazlewood', team: 'RCB', role: 'Bowler' },
  { name: 'Venkatesh Iyer', team: 'RCB', role: 'All Rounder' },
  // DC
  { name: 'KL Rahul', team: 'DC', role: 'Wicket Keeper' },
  { name: 'Axar Patel', team: 'DC', role: 'All Rounder' },
  { name: 'Kuldeep Yadav', team: 'DC', role: 'Bowler' },
  { name: 'Mitchell Starc', team: 'DC', role: 'Bowler' },
  { name: 'David Miller', team: 'DC', role: 'Batsman' },
  // GT
  { name: 'Shubman Gill', team: 'GT', role: 'Batsman' },
  { name: 'Sai Sudharsan', team: 'GT', role: 'Batsman' },
  { name: 'Jos Buttler', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Rashid Khan', team: 'GT', role: 'All Rounder' },
  { name: 'Mohammed Siraj', team: 'GT', role: 'Bowler' },
  // LSG
  { name: 'Rishabh Pant', team: 'LSG', role: 'Wicket Keeper' },
  { name: 'Nicholas Pooran', team: 'LSG', role: 'Wicket Keeper' },
  { name: 'Mitchell Marsh', team: 'LSG', role: 'All Rounder' },
  { name: 'Mohammed Shami', team: 'LSG', role: 'Bowler' },
  // PBKS
  { name: 'Shreyas Iyer', team: 'PBKS', role: 'Batsman' },
  { name: 'Yuzvendra Chahal', team: 'PBKS', role: 'Bowler' },
  { name: 'Arshdeep Singh', team: 'PBKS', role: 'Bowler' },
  { name: 'Marcus Stoinis', team: 'PBKS', role: 'All Rounder' },
  // SRH
  { name: 'Abhishek Sharma', team: 'SRH', role: 'All Rounder' },
  { name: 'Travis Head', team: 'SRH', role: 'Batsman' },
  { name: 'Ishan Kishan', team: 'SRH', role: 'Wicket Keeper' },
  { name: 'Heinrich Klaasen', team: 'SRH', role: 'Wicket Keeper' },
  { name: 'Pat Cummins', team: 'SRH', role: 'Bowler' },
];

const MANAGERS_DATA = [
  { name: 'Abhi', team_name: 'Abhi' },
  { name: 'Sahith', team_name: 'Sahith' },
  { name: 'Jasthi', team_name: 'Jasthi' },
  { name: 'Vamsi', team_name: 'Vamsi' },
  { name: 'Krishna', team_name: 'Krishna' },
  { name: 'Krithik', team_name: 'Krithik' },
  { name: 'Akash', team_name: 'Akash' },
  { name: 'Santosh', team_name: 'Santosh' },
];

export const useSeedDatabase = () => {
  const [seeding, setSeeding] = useState(false);

  const seedDatabase = useCallback(async () => {
    setSeeding(true);
    try {
      // Check if data already exists
      const { data: existingPlayers } = await supabase.from('players').select('id').limit(1);
      const { data: existingManagers } = await supabase.from('managers').select('id').limit(1);

      if (existingPlayers && existingPlayers.length > 0 && existingManagers && existingManagers.length > 0) {
        console.log('Database already seeded');
        return true;
      }

      // Seed players
      if (!existingPlayers || existingPlayers.length === 0) {
        const { error: playersError } = await supabase.from('players').insert(PLAYERS_DATA);
        if (playersError) {
          console.error('Error seeding players:', playersError);
          throw playersError;
        }
        console.log('Players seeded successfully');
      }

      // Seed managers and get their IDs
      if (!existingManagers || existingManagers.length === 0) {
        const { data: insertedManagers, error: managersError } = await supabase
          .from('managers')
          .insert(MANAGERS_DATA)
          .select();
        
        if (managersError) {
          console.error('Error seeding managers:', managersError);
          throw managersError;
        }
        console.log('Managers seeded successfully');

        // Create schedule using manager IDs
        if (insertedManagers && insertedManagers.length === 8) {
          const managerIds = insertedManagers.map(m => m.id);
          const [m1, m2, m3, m4, m5, m6, m7, m8] = managerIds;

          const scheduleData = [
            // Week 1
            { week: 1, home_manager_id: m1, away_manager_id: m8 },
            { week: 1, home_manager_id: m4, away_manager_id: m6 },
            { week: 1, home_manager_id: m7, away_manager_id: m5 },
            { week: 1, home_manager_id: m3, away_manager_id: m2 },
            // Week 2
            { week: 2, home_manager_id: m1, away_manager_id: m3 },
            { week: 2, home_manager_id: m6, away_manager_id: m2 },
            { week: 2, home_manager_id: m7, away_manager_id: m4 },
            { week: 2, home_manager_id: m8, away_manager_id: m5 },
            // Week 3
            { week: 3, home_manager_id: m1, away_manager_id: m2 },
            { week: 3, home_manager_id: m4, away_manager_id: m5 },
            { week: 3, home_manager_id: m7, away_manager_id: m3 },
            { week: 3, home_manager_id: m8, away_manager_id: m6 },
            // Week 4
            { week: 4, home_manager_id: m1, away_manager_id: m6 },
            { week: 4, home_manager_id: m4, away_manager_id: m2 },
            { week: 4, home_manager_id: m7, away_manager_id: m8 },
            { week: 4, home_manager_id: m5, away_manager_id: m3 },
            // Week 5
            { week: 5, home_manager_id: m1, away_manager_id: m7 },
            { week: 5, home_manager_id: m6, away_manager_id: m3 },
            { week: 5, home_manager_id: m5, away_manager_id: m2 },
            { week: 5, home_manager_id: m4, away_manager_id: m8 },
            // Week 6
            { week: 6, home_manager_id: m1, away_manager_id: m4 },
            { week: 6, home_manager_id: m7, away_manager_id: m2 },
            { week: 6, home_manager_id: m5, away_manager_id: m6 },
            { week: 6, home_manager_id: m8, away_manager_id: m3 },
            // Week 7
            { week: 7, home_manager_id: m1, away_manager_id: m5 },
            { week: 7, home_manager_id: m4, away_manager_id: m3 },
            { week: 7, home_manager_id: m7, away_manager_id: m6 },
            { week: 7, home_manager_id: m8, away_manager_id: m2 },
          ];

          const { error: scheduleError } = await supabase.from('schedule').insert(scheduleData);
          if (scheduleError) {
            console.error('Error seeding schedule:', scheduleError);
            throw scheduleError;
          }
          console.log('Schedule seeded successfully');
        }
      }

      return true;
    } catch (error) {
      console.error('Error seeding database:', error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, []);

  return { seedDatabase, seeding };
};
