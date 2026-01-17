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
  { name: 'Sherfane Rutherford', team: 'MI', role: 'All Rounder' },
  { name: 'Corbin Bosch', team: 'MI', role: 'All Rounder' },
  { name: 'Ashwani Kumar', team: 'MI', role: 'Bowler' },
  { name: 'Mayank Markande', team: 'MI', role: 'Bowler' },
  { name: 'Robin Minz', team: 'MI', role: 'Wicket Keeper' },
  { name: 'Allah Ghazanfar', team: 'MI', role: 'Bowler' },
  { name: 'Raj Angad Bawa', team: 'MI', role: 'All Rounder' },
  { name: 'Raghu Sharma', team: 'MI', role: 'Bowler' },
  { name: 'Danish Malewar', team: 'MI', role: 'Batsman' },
  { name: 'Mohammed Izhar', team: 'MI', role: 'Bowler' },
  { name: 'Mayank Rawat', team: 'MI', role: 'All Rounder' },
  { name: 'Atharva Ankolekar', team: 'MI', role: 'All Rounder' },
  // Kolkata Knight Riders
  { name: 'Sunil Narine', team: 'KKR', role: 'All Rounder' },
  { name: 'Cameron Green', team: 'KKR', role: 'All Rounder' },
  { name: 'Varun Chakravarthy', team: 'KKR', role: 'Bowler' },
  { name: 'Ajinkya Rahane', team: 'KKR', role: 'Batsman' },
  { name: 'Harshit Rana', team: 'KKR', role: 'Bowler' },
  { name: 'Matheesha Pathirana', team: 'KKR', role: 'Bowler' },
  { name: 'Rinku Singh', team: 'KKR', role: 'Batsman' },
  { name: 'Ramandeep Singh', team: 'KKR', role: 'All Rounder' },
  { name: 'Mustafizur Rahman', team: 'KKR', role: 'Bowler' },
  { name: 'Rahul Tripathi', team: 'KKR', role: 'Batsman' },
  { name: 'Angkrish Raghuvanshi', team: 'KKR', role: 'Batsman' },
  { name: 'Vaibhav Arora', team: 'KKR', role: 'Bowler' },
  { name: 'Akash Deep', team: 'KKR', role: 'Bowler' },
  { name: 'Rachin Ravindra', team: 'KKR', role: 'All Rounder' },
  { name: 'Tim Seifert', team: 'KKR', role: 'Wicket Keeper' },
  { name: 'Rovman Powell', team: 'KKR', role: 'Batsman' },
  { name: 'Umran Malik', team: 'KKR', role: 'Bowler' },
  { name: 'Finn Allen', team: 'KKR', role: 'Wicket Keeper' },
  { name: 'Kartik Tyagi', team: 'KKR', role: 'Bowler' },
  { name: 'Prashant Solanki', team: 'KKR', role: 'Bowler' },
  { name: 'Manish Pandey', team: 'KKR', role: 'Batsman' },
  { name: 'Anukul Roy', team: 'KKR', role: 'All Rounder' },
  { name: 'Daksh Kamra', team: 'KKR', role: 'All Rounder' },
  { name: 'Sarthak Ranjan', team: 'KKR', role: 'Batsman' },
  { name: 'Tejasvi Dahiya', team: 'KKR', role: 'Wicket Keeper' },
  // Chennai Super Kings
  { name: 'Sanju Samson', team: 'CSK', role: 'Wicket Keeper' },
  { name: 'Ruturaj Gaikwad', team: 'CSK', role: 'Batsman' },
  { name: 'Noor Ahmad', team: 'CSK', role: 'Bowler' },
  { name: 'Shivam Dube', team: 'CSK', role: 'All Rounder' },
  { name: 'Dewald Brevis', team: 'CSK', role: 'Batsman' },
  { name: 'Ayush Mhatre', team: 'CSK', role: 'Batsman' },
  { name: 'Khaleel Ahmed', team: 'CSK', role: 'Bowler' },
  { name: 'Anshul Kamboj', team: 'CSK', role: 'Bowler' },
  { name: 'Prasanth Veer', team: 'CSK', role: 'All Rounder' },
  { name: 'Kartik Sharma', team: 'CSK', role: 'Batsman' },
  { name: 'Urvil Patel', team: 'CSK', role: 'Wicket Keeper' },
  { name: 'Nathan Ellis', team: 'CSK', role: 'Bowler' },
  { name: 'MS Dhoni', team: 'CSK', role: 'Wicket Keeper' },
  { name: 'Rahul Chahar', team: 'CSK', role: 'Bowler' },
  { name: 'Matt Henry', team: 'CSK', role: 'Bowler' },
  { name: 'Sarfaraz Khan', team: 'CSK', role: 'Batsman' },
  { name: 'Akeal Hosein', team: 'CSK', role: 'Bowler' },
  { name: 'Jamie Overton', team: 'CSK', role: 'All Rounder' },
  { name: 'Mathew Short', team: 'CSK', role: 'All Rounder' },
  { name: 'Ramakrishna Ghosh', team: 'CSK', role: 'Bowler' },
  { name: 'Gurjapneet Singh', team: 'CSK', role: 'Bowler' },
  { name: 'Mukesh Choudhary', team: 'CSK', role: 'Bowler' },
  { name: 'Shreyas Gopal', team: 'CSK', role: 'Bowler' },
  { name: 'Aman Khan', team: 'CSK', role: 'All Rounder' },
  { name: 'Zakary Foulkes', team: 'CSK', role: 'All Rounder' },
  // Rajasthan Royals
  { name: 'Yashasvi Jaiswal', team: 'RR', role: 'Batsman' },
  { name: 'Ravindra Jadeja', team: 'RR', role: 'All Rounder' },
  { name: 'Vaibhav Suryavanshi', team: 'RR', role: 'Batsman' },
  { name: 'Riyan Parag', team: 'RR', role: 'All Rounder' },
  { name: 'Jofra Archer', team: 'RR', role: 'Bowler' },
  { name: 'Dhruv Jurel', team: 'RR', role: 'Wicket Keeper' },
  { name: 'Ravi Bishnoi', team: 'RR', role: 'Bowler' },
  { name: 'Shimron Hetmyer', team: 'RR', role: 'Batsman' },
  { name: 'Sandeep Sharma', team: 'RR', role: 'Bowler' },
  { name: 'Sam Curran', team: 'RR', role: 'All Rounder' },
  { name: 'Tushar Deshpande', team: 'RR', role: 'Bowler' },
  { name: 'Shubham Dubey', team: 'RR', role: 'Batsman' },
  { name: 'Vignesh Puthur', team: 'RR', role: 'Bowler' },
  { name: 'Aman Rao Perala', team: 'RR', role: 'All Rounder' },
  { name: 'Lhuan-Dre Pretorious', team: 'RR', role: 'Wicket Keeper' },
  { name: 'Donovan Ferreira', team: 'RR', role: 'Wicket Keeper' },
  { name: 'Nandre Burger', team: 'RR', role: 'Bowler' },
  { name: 'Kuldeep Sen', team: 'RR', role: 'Bowler' },
  { name: 'Adam Milne', team: 'RR', role: 'Bowler' },
  { name: 'Kwena Maphaka', team: 'RR', role: 'Bowler' },
  { name: 'Yudhvir Singh', team: 'RR', role: 'All Rounder' },
  { name: 'Sushant Mishra', team: 'RR', role: 'Bowler' },
  { name: 'Yash Raj Punja', team: 'RR', role: 'Batsman' },
  { name: 'Ravi Singh', team: 'RR', role: 'Bowler' },
  { name: 'Brijesh Sharma', team: 'RR', role: 'Bowler' },
  // Royal Challengers Bangalore
  { name: 'Virat Kohli', team: 'RCB', role: 'Batsman' },
  { name: 'Phil Salt', team: 'RCB', role: 'Wicket Keeper' },
  { name: 'Rajat Patidar', team: 'RCB', role: 'Batsman' },
  { name: 'Josh Hazlewood', team: 'RCB', role: 'Bowler' },
  { name: 'Bhuvneshwar Kumar', team: 'RCB', role: 'Bowler' },
  { name: 'Venkatesh Iyer', team: 'RCB', role: 'All Rounder' },
  { name: 'Krunal Pandya', team: 'RCB', role: 'All Rounder' },
  { name: 'Devdutt Padikkal', team: 'RCB', role: 'Batsman' },
  { name: 'Jitesh Sharma', team: 'RCB', role: 'Wicket Keeper' },
  { name: 'Yash Dayal', team: 'RCB', role: 'Bowler' },
  { name: 'Suyash Sharma', team: 'RCB', role: 'Bowler' },
  { name: 'Rasikh Dar', team: 'RCB', role: 'Bowler' },
  { name: 'Tim David', team: 'RCB', role: 'Batsman' },
  { name: 'Romario Shepherd', team: 'RCB', role: 'All Rounder' },
  { name: 'Jacob Bethell', team: 'RCB', role: 'All Rounder' },
  { name: 'Jacob Duffy', team: 'RCB', role: 'Bowler' },
  { name: 'Nuwan Thushara', team: 'RCB', role: 'Bowler' },
  { name: 'Mangesh Yadav', team: 'RCB', role: 'Bowler' },
  { name: 'Swapnil Singh', team: 'RCB', role: 'All Rounder' },
  { name: 'Abhinandan Singh', team: 'RCB', role: 'Bowler' },
  { name: 'Satvik Deswal', team: 'RCB', role: 'Bowler' },
  { name: 'Jordan Cox', team: 'RCB', role: 'Wicket Keeper' },
  { name: 'Vicky Ostwal', team: 'RCB', role: 'Bowler' },
  { name: 'Vihaan Malhotra', team: 'RCB', role: 'Batsman' },
  { name: 'Kanishk Chouhan', team: 'RCB', role: 'All Rounder' },
  // Delhi Capitals
  { name: 'KL Rahul', team: 'DC', role: 'Wicket Keeper' },
  { name: 'Axar Patel', team: 'DC', role: 'All Rounder' },
  { name: 'Kuldeep Yadav', team: 'DC', role: 'Bowler' },
  { name: 'Mitchell Starc', team: 'DC', role: 'Bowler' },
  { name: 'Tristan Stubbs', team: 'DC', role: 'Wicket Keeper' },
  { name: 'Nitish Rana', team: 'DC', role: 'Batsman' },
  { name: 'Ashutosh Sharma', team: 'DC', role: 'Batsman' },
  { name: 'Vipraj Nigam', team: 'DC', role: 'Bowler' },
  { name: 'David Miller', team: 'DC', role: 'Batsman' },
  { name: 'T Natarajan', team: 'DC', role: 'Bowler' },
  { name: 'Prithvi Shaw', team: 'DC', role: 'Batsman' },
  { name: 'Abishek Porel', team: 'DC', role: 'Wicket Keeper' },
  { name: 'Auqib Nabi Dar', team: 'DC', role: 'All Rounder' },
  { name: 'Sameer Rizvi', team: 'DC', role: 'Batsman' },
  { name: 'Karun Nair', team: 'DC', role: 'Batsman' },
  { name: 'Pathum Nissanka', team: 'DC', role: 'Batsman' },
  { name: 'Kyle Jamieson', team: 'DC', role: 'All Rounder' },
  { name: 'Dushmantha Chameera', team: 'DC', role: 'Bowler' },
  { name: 'Lungi Ngidi', team: 'DC', role: 'Bowler' },
  { name: 'Ben Duckett', team: 'DC', role: 'Wicket Keeper' },
  { name: 'Ajay Mandal', team: 'DC', role: 'All Rounder' },
  { name: 'Madhav Tiwari', team: 'DC', role: 'All Rounder' },
  { name: 'Tripurana Vijay', team: 'DC', role: 'Bowler' },
  { name: 'Sahil Parekh', team: 'DC', role: 'Bowler' },
  // Gujarat Titans
  { name: 'Shubman Gill', team: 'GT', role: 'Batsman' },
  { name: 'Sai Sudharsan', team: 'GT', role: 'Batsman' },
  { name: 'Jos Buttler', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Rashid Khan', team: 'GT', role: 'All Rounder' },
  { name: 'Mohammed Siraj', team: 'GT', role: 'Bowler' },
  { name: 'Prasidh Krishna', team: 'GT', role: 'Bowler' },
  { name: 'Kagiso Rabada', team: 'GT', role: 'Bowler' },
  { name: 'Sai Kishore', team: 'GT', role: 'Bowler' },
  { name: 'Washington Sundar', team: 'GT', role: 'All Rounder' },
  { name: 'Glenn Phillips', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Rahul Tewatia', team: 'GT', role: 'All Rounder' },
  { name: 'Jason Holder', team: 'GT', role: 'All Rounder' },
  { name: 'Ishant Sharma', team: 'GT', role: 'Bowler' },
  { name: 'Arshad Khan', team: 'GT', role: 'All Rounder' },
  { name: 'Ashok Sharma', team: 'GT', role: 'Bowler' },
  { name: 'Manav Suthar', team: 'GT', role: 'Bowler' },
  { name: 'Shahrukh Khan', team: 'GT', role: 'Batsman' },
  { name: 'Kumar Kushagra', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Nishant Sindhu', team: 'GT', role: 'All Rounder' },
  { name: 'Gurnoor Brar', team: 'GT', role: 'Bowler' },
  { name: 'Jayant Yadav', team: 'GT', role: 'All Rounder' },
  { name: 'Anuj Rawat', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Tom Banton', team: 'GT', role: 'Wicket Keeper' },
  { name: 'Prithvi Raj Yarra', team: 'GT', role: 'Bowler' },
  { name: 'Luke Wood', team: 'GT', role: 'Bowler' },
  // Lucknow Super Giants
  { name: 'Rishabh Pant', team: 'LSG', role: 'Wicket Keeper' },
  { name: 'Nicholas Pooran', team: 'LSG', role: 'Wicket Keeper' },
  { name: 'Mitchell Marsh', team: 'LSG', role: 'All Rounder' },
  { name: 'Aiden Markram', team: 'LSG', role: 'Batsman' },
  { name: 'Mohammed Shami', team: 'LSG', role: 'Bowler' },
  { name: 'Ayush Badoni', team: 'LSG', role: 'Batsman' },
  { name: 'Avesh Khan', team: 'LSG', role: 'Bowler' },
  { name: 'Digvesh Singh Rathi', team: 'LSG', role: 'Bowler' },
  { name: 'Abdul Samad', team: 'LSG', role: 'Batsman' },
  { name: 'Shahbaz Ahmed', team: 'LSG', role: 'All Rounder' },
  { name: 'Wanindu Hasaranga', team: 'LSG', role: 'All Rounder' },
  { name: 'Anrich Nortje', team: 'LSG', role: 'Bowler' },
  { name: 'Mayank Yadav', team: 'LSG', role: 'Bowler' },
  { name: 'Mohsin Khan', team: 'LSG', role: 'Bowler' },
  { name: 'Matthew Breetzke', team: 'LSG', role: 'Wicket Keeper' },
  { name: 'Mukul Choudhary', team: 'LSG', role: 'Bowler' },
  { name: 'Akash Singh', team: 'LSG', role: 'Bowler' },
  { name: 'Arjun Tendulkar', team: 'LSG', role: 'All Rounder' },
  { name: 'Naman Tiwari', team: 'LSG', role: 'Bowler' },
  { name: 'Himmat Singh', team: 'LSG', role: 'Batsman' },
  { name: 'Arshin Kulkarni', team: 'LSG', role: 'All Rounder' },
  { name: 'M Siddharth', team: 'LSG', role: 'Bowler' },
  { name: 'Prince Yadav', team: 'LSG', role: 'All Rounder' },
  { name: 'Akshat Raghuwanshi', team: 'LSG', role: 'Batsman' },
  { name: 'Josh Inglis', team: 'LSG', role: 'Wicket Keeper' },
  // Punjab Kings
  { name: 'Shreyas Iyer', team: 'PBKS', role: 'Batsman' },
  { name: 'Yuzvendra Chahal', team: 'PBKS', role: 'Bowler' },
  { name: 'Arshdeep Singh', team: 'PBKS', role: 'Bowler' },
  { name: 'Priyansh Arya', team: 'PBKS', role: 'Batsman' },
  { name: 'Marco Jansen', team: 'PBKS', role: 'All Rounder' },
  { name: 'Prabhsimran Singh', team: 'PBKS', role: 'Wicket Keeper' },
  { name: 'Marcus Stoinis', team: 'PBKS', role: 'All Rounder' },
  { name: 'Shashank Singh', team: 'PBKS', role: 'Batsman' },
  { name: 'Lockie Ferguson', team: 'PBKS', role: 'Bowler' },
  { name: 'Mitch Owen', team: 'PBKS', role: 'All Rounder' },
  { name: 'Nehal Wadhera', team: 'PBKS', role: 'Batsman' },
  { name: 'Harpreet Brar', team: 'PBKS', role: 'All Rounder' },
  { name: 'Azmatullah Omarzai', team: 'PBKS', role: 'All Rounder' },
  { name: 'Yash Thakur', team: 'PBKS', role: 'Bowler' },
  { name: 'Vyshak Vijaykumar', team: 'PBKS', role: 'Bowler' },
  { name: 'Vishnu Vinod', team: 'PBKS', role: 'Wicket Keeper' },
  { name: 'Xavier Bartlett', team: 'PBKS', role: 'Bowler' },
  { name: 'Cooper Connolly', team: 'PBKS', role: 'All Rounder' },
  { name: 'Pyla Avinash', team: 'PBKS', role: 'Wicket Keeper' },
  { name: 'Harnoor Pannu', team: 'PBKS', role: 'Batsman' },
  { name: 'Suryansh Shedge', team: 'PBKS', role: 'All Rounder' },
  { name: 'Ben Dwarshuis', team: 'PBKS', role: 'Bowler' },
  { name: 'Musheer Khan', team: 'PBKS', role: 'All Rounder' },
  { name: 'Vishal Nishad', team: 'PBKS', role: 'All Rounder' },
  { name: 'Praveen Dubey', team: 'PBKS', role: 'Bowler' },
  // Sunrisers Hyderabad
  { name: 'Abhishek Sharma', team: 'SRH', role: 'All Rounder' },
  { name: 'Travis Head', team: 'SRH', role: 'Batsman' },
  { name: 'Ishan Kishan', team: 'SRH', role: 'Wicket Keeper' },
  { name: 'Heinrich Klaasen', team: 'SRH', role: 'Wicket Keeper' },
  { name: 'Pat Cummins', team: 'SRH', role: 'Bowler' },
  { name: 'Harshal Patel', team: 'SRH', role: 'Bowler' },
  { name: 'Nitish Kumar Reddy', team: 'SRH', role: 'All Rounder' },
  { name: 'Liam Livingstone', team: 'SRH', role: 'All Rounder' },
  { name: 'Aniket Varma', team: 'SRH', role: 'Batsman' },
  { name: 'Jaydev Unadkat', team: 'SRH', role: 'Bowler' },
  { name: 'Harsh Dubey', team: 'SRH', role: 'All Rounder' },
  { name: 'Smaran Ravichandran', team: 'SRH', role: 'Batsman' },
  { name: 'Salil Arora', team: 'SRH', role: 'Wicket Keeper' },
  { name: 'Zeeshan Ansari', team: 'SRH', role: 'Bowler' },
  { name: 'Shivam Mavi', team: 'SRH', role: 'Bowler' },
  { name: 'Echan Malinga', team: 'SRH', role: 'Bowler' },
  { name: 'Brydon Carse', team: 'SRH', role: 'All Rounder' },
  { name: 'Shivang Kumar', team: 'SRH', role: 'Batsman' },
  { name: 'Kamindu Mendis', team: 'SRH', role: 'All Rounder' },
  { name: 'Sakib Hussain', team: 'SRH', role: 'Bowler' },
  { name: 'Onkar Tarmale', team: 'SRH', role: 'Bowler' },
  { name: 'Amit Kumar', team: 'SRH', role: 'All Rounder' },
  { name: 'Praful Hinge', team: 'SRH', role: 'Bowler' },
  { name: 'Krains Fuletra', team: 'SRH', role: 'Bowler' },
  { name: 'Jack Edwards', team: 'SRH', role: 'All Rounder' },
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

  const reseedPlayers = useCallback(async () => {
    setSeeding(true);
    try {
      // First, we need to clear all manager rosters since they reference player IDs
      const { error: clearRostersError } = await supabase
        .from('managers')
        .update({ roster: [], bench: [] })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
      
      if (clearRostersError) {
        console.error('Error clearing rosters:', clearRostersError);
        throw clearRostersError;
      }

      // Delete all existing players
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteError) {
        console.error('Error deleting players:', deleteError);
        throw deleteError;
      }

      // Insert new players
      const { error: insertError } = await supabase.from('players').insert(PLAYERS_DATA);
      if (insertError) {
        console.error('Error inserting players:', insertError);
        throw insertError;
      }

      console.log('Players reseeded successfully');
      return true;
    } catch (error) {
      console.error('Error reseeding players:', error);
      return false;
    } finally {
      setSeeding(false);
    }
  }, []);

  return { seedDatabase, reseedPlayers, seeding };
};
