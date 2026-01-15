import { create } from 'zustand';

export interface Player {
  id: string;
  name: string;
  team: string;
  role: 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
  points: number;
}

export interface Manager {
  id: string;
  name: string;
  teamName: string;
  wins: number;
  losses: number;
  points: number;
  activeRoster: string[];
  bench: string[];
}

export interface Match {
  week: number;
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  completed: boolean;
}

export interface Activity {
  id: string;
  timestamp: Date;
  type: 'add' | 'drop' | 'trade' | 'score';
  managerId: string;
  description: string;
}

interface GameState {
  currentWeek: number;
  currentManagerId: string;
  managers: Manager[];
  players: Player[];
  schedule: Match[];
  activities: Activity[];
  setCurrentManager: (id: string) => void;
  addPlayer: (managerId: string, playerId: string) => void;
  dropPlayer: (managerId: string, playerId: string) => void;
  moveToActive: (managerId: string, playerId: string) => void;
  moveToBench: (managerId: string, playerId: string) => void;
  updateMatchScore: (week: number, matchIndex: number, homeScore: number, awayScore: number) => void;
  resetLeague: () => void;
  executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => void;
  addFreeAgent: (managerId: string, playerId: string, dropPlayerId?: string) => void;
  getFreeAgents: () => Player[];
  getManagerRosterCount: (managerId: string) => number;
}

const IPL_TEAMS = ['MI', 'KKR', 'CSK', 'RR', 'RCB', 'DC', 'GT', 'LSG', 'PBKS', 'SRH'];

const PLAYERS: Player[] = [
  // Mumbai Indians
  { id: 'mi1', name: 'Jasprit Bumrah', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi2', name: 'Suryakumar Yadav', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'mi3', name: 'Hardik Pandya', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi4', name: 'Tilak Varma', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'mi5', name: 'Rohit Sharma', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'mi6', name: 'Trent Boult', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi7', name: 'Mitchell Santner', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi8', name: 'Naman Dhir', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi9', name: 'Ryan Rickelton', team: 'MI', role: 'Wicket Keeper', points: 0 },
  { id: 'mi10', name: 'Deepak Chahar', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi11', name: 'Will Jacks', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi12', name: 'Quinton de Kock', team: 'MI', role: 'Wicket Keeper', points: 0 },
  { id: 'mi13', name: 'Shardul Thakur', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi14', name: 'Sherfane Rutherford', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi15', name: 'Corbin Bosch', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi16', name: 'Ashwani Kumar', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi17', name: 'Mayank Markande', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi18', name: 'Robin Minz', team: 'MI', role: 'Wicket Keeper', points: 0 },
  { id: 'mi19', name: 'Allah Ghazanfar', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi20', name: 'Raj Angad Bawa', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi21', name: 'Raghu Sharma', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi22', name: 'Danish Malewar', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'mi23', name: 'Mohammed Izhar', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'mi24', name: 'Mayank Rawat', team: 'MI', role: 'All Rounder', points: 0 },
  { id: 'mi25', name: 'Atharva Ankolekar', team: 'MI', role: 'All Rounder', points: 0 },

  // Kolkata Knight Riders
  { id: 'kkr1', name: 'Sunil Narine', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr2', name: 'Cameron Green', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr3', name: 'Varun Chakravarthy', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr4', name: 'Ajinkya Rahane', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr5', name: 'Harshit Rana', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr6', name: 'Matheesha Pathirana', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr7', name: 'Rinku Singh', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr8', name: 'Ramandeep Singh', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr9', name: 'Mustafizur Rahman', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr10', name: 'Rahul Tripathi', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr11', name: 'Angkrish Raghuvanshi', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr12', name: 'Vaibhav Arora', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr13', name: 'Akash Deep', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr14', name: 'Rachin Ravindra', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr15', name: 'Tim Seifert', team: 'KKR', role: 'Wicket Keeper', points: 0 },
  { id: 'kkr16', name: 'Rovman Powell', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr17', name: 'Umran Malik', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr18', name: 'Finn Allen', team: 'KKR', role: 'Wicket Keeper', points: 0 },
  { id: 'kkr19', name: 'Kartik Tyagi', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr20', name: 'Prashant Solanki', team: 'KKR', role: 'Bowler', points: 0 },
  { id: 'kkr21', name: 'Manish Pandey', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr22', name: 'Anukul Roy', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr23', name: 'Daksh Kamra', team: 'KKR', role: 'All Rounder', points: 0 },
  { id: 'kkr24', name: 'Sarthak Ranjan', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'kkr25', name: 'Tejasvi Dahiya', team: 'KKR', role: 'Wicket Keeper', points: 0 },

  // Chennai Super Kings
  { id: 'csk1', name: 'Sanju Samson', team: 'CSK', role: 'Wicket Keeper', points: 0 },
  { id: 'csk2', name: 'Ruturaj Gaikwad', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'csk3', name: 'Noor Ahmad', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk4', name: 'Shivam Dube', team: 'CSK', role: 'All Rounder', points: 0 },
  { id: 'csk5', name: 'Dewald Brevis', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'csk6', name: 'Ayush Mhatre', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'csk7', name: 'Khaleel Ahmed', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk8', name: 'Anshul Kamboj', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk9', name: 'Prasanth Veer', team: 'CSK', role: 'All Rounder', points: 0 },
  { id: 'csk10', name: 'Kartik Sharma', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'csk11', name: 'Urvil Patel', team: 'CSK', role: 'Wicket Keeper', points: 0 },
  { id: 'csk12', name: 'Nathan Ellis', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk13', name: 'MS Dhoni', team: 'CSK', role: 'Wicket Keeper', points: 0 },
  { id: 'csk14', name: 'Rahul Chahar', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk15', name: 'Matt Henry', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk16', name: 'Sarfaraz Khan', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'csk17', name: 'Akeal Hosein', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk18', name: 'Jamie Overton', team: 'CSK', role: 'All Rounder', points: 0 },
  { id: 'csk19', name: 'Mathew Short', team: 'CSK', role: 'All Rounder', points: 0 },
  { id: 'csk20', name: 'Ramakrishna Ghosh', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk21', name: 'Gurjapneet Singh', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk22', name: 'Mukesh Choudhary', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk23', name: 'Shreyas Gopal', team: 'CSK', role: 'Bowler', points: 0 },
  { id: 'csk24', name: 'Aman Khan', team: 'CSK', role: 'All Rounder', points: 0 },
  { id: 'csk25', name: 'Zakary Foulkes', team: 'CSK', role: 'All Rounder', points: 0 },

  // Rajasthan Royals
  { id: 'rr1', name: 'Yashasvi Jaiswal', team: 'RR', role: 'Batsman', points: 0 },
  { id: 'rr2', name: 'Ravindra Jadeja', team: 'RR', role: 'All Rounder', points: 0 },
  { id: 'rr3', name: 'Vaibhav Suryavanshi', team: 'RR', role: 'Batsman', points: 0 },
  { id: 'rr4', name: 'Riyan Parag', team: 'RR', role: 'All Rounder', points: 0 },
  { id: 'rr5', name: 'Jofra Archer', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr6', name: 'Dhruv Jurel', team: 'RR', role: 'Wicket Keeper', points: 0 },
  { id: 'rr7', name: 'Ravi Bishnoi', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr8', name: 'Shimron Hetmyer', team: 'RR', role: 'Batsman', points: 0 },
  { id: 'rr9', name: 'Sandeep Sharma', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr10', name: 'Sam Curran', team: 'RR', role: 'All Rounder', points: 0 },
  { id: 'rr11', name: 'Tushar Deshpande', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr12', name: 'Shubham Dubey', team: 'RR', role: 'Batsman', points: 0 },
  { id: 'rr13', name: 'Vignesh Puthur', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr14', name: 'Aman Rao Perala', team: 'RR', role: 'All Rounder', points: 0 },
  { id: 'rr15', name: 'Lhuan-Dre Pretorious', team: 'RR', role: 'Wicket Keeper', points: 0 },
  { id: 'rr16', name: 'Donovan Ferreira', team: 'RR', role: 'Wicket Keeper', points: 0 },
  { id: 'rr17', name: 'Nandre Burger', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr18', name: 'Kuldeep Sen', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr19', name: 'Adam Milne', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr20', name: 'Kwena Maphaka', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr21', name: 'Yudhvir Singh', team: 'RR', role: 'All Rounder', points: 0 },
  { id: 'rr22', name: 'Sushant Mishra', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr23', name: 'Yash Raj Punja', team: 'RR', role: 'Batsman', points: 0 },
  { id: 'rr24', name: 'Ravi Singh', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'rr25', name: 'Brijesh Sharma', team: 'RR', role: 'Bowler', points: 0 },

  // Royal Challengers Bangalore
  { id: 'rcb1', name: 'Virat Kohli', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'rcb2', name: 'Phil Salt', team: 'RCB', role: 'Wicket Keeper', points: 0 },
  { id: 'rcb3', name: 'Rajat Patidar', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'rcb4', name: 'Josh Hazlewood', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb5', name: 'Bhuvneshwar Kumar', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb6', name: 'Venkatesh Iyer', team: 'RCB', role: 'All Rounder', points: 0 },
  { id: 'rcb7', name: 'Krunal Pandya', team: 'RCB', role: 'All Rounder', points: 0 },
  { id: 'rcb8', name: 'Devdutt Padikkal', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'rcb9', name: 'Jitesh Sharma', team: 'RCB', role: 'Wicket Keeper', points: 0 },
  { id: 'rcb10', name: 'Yash Dayal', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb11', name: 'Suyash Sharma', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb12', name: 'Rasikh Dar', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb13', name: 'Tim David', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'rcb14', name: 'Romario Shepherd', team: 'RCB', role: 'All Rounder', points: 0 },
  { id: 'rcb15', name: 'Jacob Bethell', team: 'RCB', role: 'All Rounder', points: 0 },
  { id: 'rcb16', name: 'Jacob Duffy', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb17', name: 'Nuwan Thushara', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb18', name: 'Mangesh Yadav', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb19', name: 'Swapnil Singh', team: 'RCB', role: 'All Rounder', points: 0 },
  { id: 'rcb20', name: 'Abhinandan Singh', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb21', name: 'Satvik Deswal', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb22', name: 'Jordan Cox', team: 'RCB', role: 'Wicket Keeper', points: 0 },
  { id: 'rcb23', name: 'Vicky Ostwal', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'rcb24', name: 'Vihaan Malhotra', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'rcb25', name: 'Kanishk Chouhan', team: 'RCB', role: 'All Rounder', points: 0 },

  // Delhi Capitals
  { id: 'dc1', name: 'KL Rahul', team: 'DC', role: 'Wicket Keeper', points: 0 },
  { id: 'dc2', name: 'Axar Patel', team: 'DC', role: 'All Rounder', points: 0 },
  { id: 'dc3', name: 'Kuldeep Yadav', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc4', name: 'Mitchell Starc', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc5', name: 'Tristan Stubbs', team: 'DC', role: 'Wicket Keeper', points: 0 },
  { id: 'dc6', name: 'Nitish Rana', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc7', name: 'Ashutosh Sharma', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc8', name: 'Vipraj Nigam', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc9', name: 'David Miller', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc10', name: 'T Natarajan', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc11', name: 'Prithvi Shaw', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc12', name: 'Abishek Porel', team: 'DC', role: 'Wicket Keeper', points: 0 },
  { id: 'dc13', name: 'Auqib Nabi Dar', team: 'DC', role: 'All Rounder', points: 0 },
  { id: 'dc14', name: 'Sameer Rizvi', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc15', name: 'Karun Nair', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc16', name: 'Pathum Nissanka', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'dc17', name: 'Kyle Jamieson', team: 'DC', role: 'All Rounder', points: 0 },
  { id: 'dc18', name: 'Dushmantha Chameera', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc19', name: 'Lungi Ngidi', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc20', name: 'Ben Duckett', team: 'DC', role: 'Wicket Keeper', points: 0 },
  { id: 'dc21', name: 'Ajay Mandal', team: 'DC', role: 'All Rounder', points: 0 },
  { id: 'dc22', name: 'Madhav Tiwari', team: 'DC', role: 'All Rounder', points: 0 },
  { id: 'dc23', name: 'Tripurana Vijay', team: 'DC', role: 'Bowler', points: 0 },
  { id: 'dc24', name: 'Sahil Parekh', team: 'DC', role: 'Bowler', points: 0 },

  // Gujarat Titans
  { id: 'gt1', name: 'Shubman Gill', team: 'GT', role: 'Batsman', points: 0 },
  { id: 'gt2', name: 'Sai Sudharsan', team: 'GT', role: 'Batsman', points: 0 },
  { id: 'gt3', name: 'Jos Buttler', team: 'GT', role: 'Wicket Keeper', points: 0 },
  { id: 'gt4', name: 'Rashid Khan', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt5', name: 'Mohammed Siraj', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt6', name: 'Prasidh Krishna', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt7', name: 'Kagiso Rabada', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt8', name: 'Sai Kishore', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt9', name: 'Washington Sundar', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt10', name: 'Glenn Phillips', team: 'GT', role: 'Wicket Keeper', points: 0 },
  { id: 'gt11', name: 'Rahul Tewatia', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt12', name: 'Jason Holder', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt13', name: 'Ishant Sharma', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt14', name: 'Arshad Khan', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt15', name: 'Ashok Sharma', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt16', name: 'Manav Suthar', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt17', name: 'Shahrukh Khan', team: 'GT', role: 'Batsman', points: 0 },
  { id: 'gt18', name: 'Kumar Kushagra', team: 'GT', role: 'Wicket Keeper', points: 0 },
  { id: 'gt19', name: 'Nishant Sindhu', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt20', name: 'Gurnoor Brar', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt21', name: 'Jayant Yadav', team: 'GT', role: 'All Rounder', points: 0 },
  { id: 'gt22', name: 'Anuj Rawat', team: 'GT', role: 'Wicket Keeper', points: 0 },
  { id: 'gt23', name: 'Tom Banton', team: 'GT', role: 'Wicket Keeper', points: 0 },
  { id: 'gt24', name: 'Prithvi Raj Yarra', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'gt25', name: 'Luke Wood', team: 'GT', role: 'Bowler', points: 0 },

  // Lucknow Super Giants
  { id: 'lsg1', name: 'Rishabh Pant', team: 'LSG', role: 'Wicket Keeper', points: 0 },
  { id: 'lsg2', name: 'Nicholas Pooran', team: 'LSG', role: 'Wicket Keeper', points: 0 },
  { id: 'lsg3', name: 'Mitchell Marsh', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg4', name: 'Aiden Markram', team: 'LSG', role: 'Batsman', points: 0 },
  { id: 'lsg5', name: 'Mohammed Shami', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg6', name: 'Ayush Badoni', team: 'LSG', role: 'Batsman', points: 0 },
  { id: 'lsg7', name: 'Avesh Khan', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg8', name: 'Digvesh Singh Rathi', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg9', name: 'Abdul Samad', team: 'LSG', role: 'Batsman', points: 0 },
  { id: 'lsg10', name: 'Shahbaz Ahmed', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg11', name: 'Wanindu Hasaranga', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg12', name: 'Anrich Nortje', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg13', name: 'Mayank Yadav', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg14', name: 'Mohsin Khan', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg15', name: 'Matthew Breetzke', team: 'LSG', role: 'Wicket Keeper', points: 0 },
  { id: 'lsg16', name: 'Mukul Choudhary', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg17', name: 'Akash Singh', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg18', name: 'Arjun Tendulkar', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg19', name: 'Naman Tiwari', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg20', name: 'Himmat Singh', team: 'LSG', role: 'Batsman', points: 0 },
  { id: 'lsg21', name: 'Arshin Kulkarni', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg22', name: 'M Siddharth', team: 'LSG', role: 'Bowler', points: 0 },
  { id: 'lsg23', name: 'Prince Yadav', team: 'LSG', role: 'All Rounder', points: 0 },
  { id: 'lsg24', name: 'Akshat Raghuwanshi', team: 'LSG', role: 'Batsman', points: 0 },
  { id: 'lsg25', name: 'Josh Inglis', team: 'LSG', role: 'Wicket Keeper', points: 0 },

  // Punjab Kings
  { id: 'pbks1', name: 'Shreyas Iyer', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'pbks2', name: 'Yuzvendra Chahal', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks3', name: 'Arshdeep Singh', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks4', name: 'Priyansh Arya', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'pbks5', name: 'Marco Jansen', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks6', name: 'Prabhsimran Singh', team: 'PBKS', role: 'Wicket Keeper', points: 0 },
  { id: 'pbks7', name: 'Marcus Stoinis', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks8', name: 'Shashank Singh', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'pbks9', name: 'Lockie Ferguson', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks10', name: 'Mitch Owen', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks11', name: 'Nehal Wadhera', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'pbks12', name: 'Harpreet Brar', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks13', name: 'Azmatullah Omarzai', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks14', name: 'Yash Thakur', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks15', name: 'Vyshak Vijaykumar', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks16', name: 'Vishnu Vinod', team: 'PBKS', role: 'Wicket Keeper', points: 0 },
  { id: 'pbks17', name: 'Xavier Bartlett', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks18', name: 'Cooper Connolly', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks19', name: 'Pyla Avinash', team: 'PBKS', role: 'Wicket Keeper', points: 0 },
  { id: 'pbks20', name: 'Harnoor Pannu', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'pbks21', name: 'Suryansh Shedge', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks22', name: 'Ben Dwarshuis', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'pbks23', name: 'Musheer Khan', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks24', name: 'Vishal Nishad', team: 'PBKS', role: 'All Rounder', points: 0 },
  { id: 'pbks25', name: 'Praveen Dubey', team: 'PBKS', role: 'Bowler', points: 0 },

  // Sunrisers Hyderabad
  { id: 'srh1', name: 'Abhishek Sharma', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh2', name: 'Travis Head', team: 'SRH', role: 'Batsman', points: 0 },
  { id: 'srh3', name: 'Ishan Kishan', team: 'SRH', role: 'Wicket Keeper', points: 0 },
  { id: 'srh4', name: 'Heinrich Klaasen', team: 'SRH', role: 'Wicket Keeper', points: 0 },
  { id: 'srh5', name: 'Pat Cummins', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh6', name: 'Harshal Patel', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh7', name: 'Nitish Kumar Reddy', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh8', name: 'Liam Livingstone', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh9', name: 'Aniket Varma', team: 'SRH', role: 'Batsman', points: 0 },
  { id: 'srh10', name: 'Jaydev Unadkat', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh11', name: 'Harsh Dubey', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh12', name: 'Smaran Ravichandran', team: 'SRH', role: 'Batsman', points: 0 },
  { id: 'srh13', name: 'Salil Arora', team: 'SRH', role: 'Wicket Keeper', points: 0 },
  { id: 'srh14', name: 'Zeeshan Ansari', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh15', name: 'Shivam Mavi', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh16', name: 'Echan Malinga', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh17', name: 'Brydon Carse', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh18', name: 'Shivang Kumar', team: 'SRH', role: 'Batsman', points: 0 },
  { id: 'srh19', name: 'Kamindu Mendis', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh20', name: 'Sakib Hussain', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh21', name: 'Onkar Tarmale', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh22', name: 'Amit Kumar', team: 'SRH', role: 'All Rounder', points: 0 },
  { id: 'srh23', name: 'Praful Hinge', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh24', name: 'Krains Fuletra', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'srh25', name: 'Jack Edwards', team: 'SRH', role: 'All Rounder', points: 0 },
];

const MANAGERS: Manager[] = [
  { id: 'm1', name: 'Abhi', teamName: 'Abhi', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm2', name: 'Sahith', teamName: 'Sahith', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm3', name: 'Jasthi', teamName: 'Jasthi', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm4', name: 'Vamsi', teamName: 'Vamsi', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm5', name: 'Krishna', teamName: 'Krishna', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm6', name: 'Krithik', teamName: 'Krithik', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm7', name: 'Akash', teamName: 'Akash', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
  { id: 'm8', name: 'Santosh', teamName: 'Santosh', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
];

const SCHEDULE: Match[] = [
  // Week 1
  { week: 1, home: 'm1', away: 'm8', completed: false }, // Abhi vs Santosh
  { week: 1, home: 'm4', away: 'm6', completed: false }, // Vamsi vs Krithik
  { week: 1, home: 'm7', away: 'm5', completed: false }, // Akash vs Krishna
  { week: 1, home: 'm3', away: 'm2', completed: false }, // Jasthi vs Sahith

  // Week 2
  { week: 2, home: 'm1', away: 'm3', completed: false }, // Abhi vs Jasthi
  { week: 2, home: 'm6', away: 'm2', completed: false }, // Krithik vs Sahith
  { week: 2, home: 'm7', away: 'm4', completed: false }, // Akash vs Vamsi
  { week: 2, home: 'm8', away: 'm5', completed: false }, // Santosh vs Krishna

  // Week 3
  { week: 3, home: 'm1', away: 'm2', completed: false }, // Abhi vs Sahith
  { week: 3, home: 'm4', away: 'm5', completed: false }, // Vamsi vs Krishna
  { week: 3, home: 'm7', away: 'm3', completed: false }, // Akash vs Jasthi
  { week: 3, home: 'm8', away: 'm6', completed: false }, // Santosh vs Krithik

  // Week 4
  { week: 4, home: 'm1', away: 'm6', completed: false }, // Abhi vs Krithik
  { week: 4, home: 'm4', away: 'm2', completed: false }, // Vamsi vs Sahith
  { week: 4, home: 'm7', away: 'm8', completed: false }, // Akash vs Santosh
  { week: 4, home: 'm5', away: 'm3', completed: false }, // Krishna vs Jasthi

  // Week 5
  { week: 5, home: 'm1', away: 'm7', completed: false }, // Abhi vs Akash
  { week: 5, home: 'm6', away: 'm3', completed: false }, // Krithik vs Jasthi
  { week: 5, home: 'm5', away: 'm2', completed: false }, // Krishna vs Sahith
  { week: 5, home: 'm4', away: 'm8', completed: false }, // Vamsi vs Santosh

  // Week 6
  { week: 6, home: 'm1', away: 'm4', completed: false }, // Abhi vs Vamsi
  { week: 6, home: 'm7', away: 'm2', completed: false }, // Akash vs Sahith
  { week: 6, home: 'm5', away: 'm6', completed: false }, // Krishna vs Krithik
  { week: 6, home: 'm8', away: 'm3', completed: false }, // Santosh vs Jasthi

  // Week 7
  { week: 7, home: 'm1', away: 'm5', completed: false }, // Abhi vs Krishna
  { week: 7, home: 'm4', away: 'm3', completed: false }, // Vamsi vs Jasthi
  { week: 7, home: 'm7', away: 'm6', completed: false }, // Akash vs Krithik
  { week: 7, home: 'm8', away: 'm2', completed: false }, // Santosh vs Sahith
];

const ROSTER_CAP = 14;

export const useGameStore = create<GameState>((set, get) => ({
  currentWeek: 1,
  currentManagerId: 'm1',
  managers: MANAGERS,
  players: PLAYERS,
  schedule: SCHEDULE,
  activities: [],

  setCurrentManager: (id) => set({ currentManagerId: id }),

  addPlayer: (managerId, playerId) => {
    const { managers, players, activities } = get();
    const manager = managers.find(m => m.id === managerId);
    const player = players.find(p => p.id === playerId);
    
    if (!manager || !player) return;
    if (manager.activeRoster.length + manager.bench.length >= ROSTER_CAP) return;

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'add',
      managerId,
      description: `${manager.teamName} added ${player.name}`,
    };

    set({
      managers: managers.map(m => 
        m.id === managerId 
          ? { ...m, bench: [...m.bench, playerId] }
          : m
      ),
      activities: [newActivity, ...activities],
    });
  },

  dropPlayer: (managerId, playerId) => {
    const { managers, players, activities } = get();
    const manager = managers.find(m => m.id === managerId);
    const player = players.find(p => p.id === playerId);
    
    if (!manager || !player) return;

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'drop',
      managerId,
      description: `${manager.teamName} dropped ${player.name}`,
    };

    set({
      managers: managers.map(m => 
        m.id === managerId 
          ? { 
              ...m, 
              activeRoster: m.activeRoster.filter(id => id !== playerId),
              bench: m.bench.filter(id => id !== playerId),
            }
          : m
      ),
      activities: [newActivity, ...activities],
    });
  },

  getFreeAgents: () => {
    const { managers, players } = get();
    const rosteredIds = new Set(
      managers.flatMap(m => [...m.activeRoster, ...m.bench])
    );
    return players.filter(p => !rosteredIds.has(p.id));
  },

  getManagerRosterCount: (managerId) => {
    const { managers } = get();
    const manager = managers.find(m => m.id === managerId);
    if (!manager) return 0;
    return manager.activeRoster.length + manager.bench.length;
  },

  addFreeAgent: (managerId, playerId, dropPlayerId) => {
    const { managers, players, activities } = get();
    const manager = managers.find(m => m.id === managerId);
    const player = players.find(p => p.id === playerId);
    const dropPlayer = dropPlayerId ? players.find(p => p.id === dropPlayerId) : null;
    
    if (!manager || !player) return;

    const rosterCount = manager.activeRoster.length + manager.bench.length;
    if (rosterCount >= ROSTER_CAP && !dropPlayerId) return;

    let description = `${manager.teamName} added ${player.name}`;
    if (dropPlayer) {
      description = `${manager.teamName} dropped ${dropPlayer.name}, added ${player.name}`;
    }

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'add',
      managerId,
      description,
    };

    set({
      managers: managers.map(m => {
        if (m.id !== managerId) return m;
        
        let newActiveRoster = [...m.activeRoster];
        let newBench = [...m.bench];
        
        // Drop player if specified
        if (dropPlayerId) {
          newActiveRoster = newActiveRoster.filter(id => id !== dropPlayerId);
          newBench = newBench.filter(id => id !== dropPlayerId);
        }
        
        // Add new player to bench
        newBench = [...newBench, playerId];
        
        return { ...m, activeRoster: newActiveRoster, bench: newBench };
      }),
      activities: [newActivity, ...activities],
    });
  },

  moveToActive: (managerId, playerId) => {
    const { managers } = get();
    const manager = managers.find(m => m.id === managerId);
    
    if (!manager || manager.activeRoster.length >= 11) return;

    set({
      managers: managers.map(m => 
        m.id === managerId 
          ? { 
              ...m, 
              activeRoster: [...m.activeRoster, playerId],
              bench: m.bench.filter(id => id !== playerId),
            }
          : m
      ),
    });
  },

  moveToBench: (managerId, playerId) => {
    const { managers } = get();
    const manager = managers.find(m => m.id === managerId);
    
    if (!manager || manager.bench.length >= 3) return;

    set({
      managers: managers.map(m => 
        m.id === managerId 
          ? { 
              ...m, 
              bench: [...m.bench, playerId],
              activeRoster: m.activeRoster.filter(id => id !== playerId),
            }
          : m
      ),
    });
  },

  updateMatchScore: (week, matchIndex, homeScore, awayScore) => {
    const { schedule, managers, activities } = get();
    
    // Find all matches for the week
    const weekMatches = schedule.filter(m => m.week === week);
    if (matchIndex >= weekMatches.length) return;
    
    const match = weekMatches[matchIndex];
    const homeManager = managers.find(m => m.id === match.home);
    const awayManager = managers.find(m => m.id === match.away);
    
    if (!homeManager || !awayManager) return;

    // Determine winner
    const homeWins = homeScore > awayScore;
    const awayWins = awayScore > homeScore;
    const tie = homeScore === awayScore;

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'score',
      managerId: match.home,
      description: `Week ${week}: ${homeManager.teamName} ${homeScore} - ${awayScore} ${awayManager.teamName}`,
    };

    // Calculate the old scores to determine win/loss adjustments
    const matchGlobalIndex = schedule.findIndex(m => m.week === week && m.home === match.home && m.away === match.away);
    const oldMatch = schedule[matchGlobalIndex];
    const hadOldScores = oldMatch.homeScore !== undefined && oldMatch.awayScore !== undefined;
    
    let homeWinDelta = 0;
    let homeLossDelta = 0;
    let awayWinDelta = 0;
    let awayLossDelta = 0;

    // Remove old win/loss if there were previous scores
    if (hadOldScores) {
      const oldHomeWon = oldMatch.homeScore! > oldMatch.awayScore!;
      const oldAwayWon = oldMatch.awayScore! > oldMatch.homeScore!;
      if (oldHomeWon) {
        homeWinDelta -= 1;
        awayLossDelta -= 1;
      } else if (oldAwayWon) {
        awayWinDelta -= 1;
        homeLossDelta -= 1;
      }
    }

    // Add new win/loss
    if (homeWins) {
      homeWinDelta += 1;
      awayLossDelta += 1;
    } else if (awayWins) {
      awayWinDelta += 1;
      homeLossDelta += 1;
    }

    set({
      schedule: schedule.map((m, idx) => {
        if (idx === matchGlobalIndex) {
          return { ...m, homeScore, awayScore, completed: true };
        }
        return m;
      }),
      managers: managers.map(m => {
        if (m.id === match.home) {
          return {
            ...m,
            wins: m.wins + homeWinDelta,
            losses: m.losses + homeLossDelta,
            points: m.points + homeScore - (hadOldScores ? oldMatch.homeScore! : 0),
          };
        }
        if (m.id === match.away) {
          return {
            ...m,
            wins: m.wins + awayWinDelta,
            losses: m.losses + awayLossDelta,
            points: m.points + awayScore - (hadOldScores ? oldMatch.awayScore! : 0),
          };
        }
        return m;
      }),
      activities: [newActivity, ...activities],
    });
  },

  resetLeague: () => {
    set({
      currentWeek: 1,
      managers: MANAGERS.map(m => ({ ...m, wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] })),
      schedule: SCHEDULE.map(m => ({ ...m, completed: false, homeScore: undefined, awayScore: undefined })),
      activities: [],
    });
  },

  executeTrade: (manager1Id, manager2Id, players1, players2) => {
    const { managers, players, activities } = get();
    const manager1 = managers.find(m => m.id === manager1Id);
    const manager2 = managers.find(m => m.id === manager2Id);
    
    if (!manager1 || !manager2) return;

    const player1Names = players1.map(id => players.find(p => p.id === id)?.name).join(', ');
    const player2Names = players2.map(id => players.find(p => p.id === id)?.name).join(', ');

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'trade',
      managerId: manager1Id,
      description: `${manager1.teamName} traded ${player1Names} to ${manager2.teamName} for ${player2Names}`,
    };

    set({
      managers: managers.map(m => {
        if (m.id === manager1Id) {
          return {
            ...m,
            activeRoster: [...m.activeRoster.filter(id => !players1.includes(id)), ...players2.filter(id => manager2.activeRoster.includes(id))],
            bench: [...m.bench.filter(id => !players1.includes(id)), ...players2.filter(id => manager2.bench.includes(id))],
          };
        }
        if (m.id === manager2Id) {
          return {
            ...m,
            activeRoster: [...m.activeRoster.filter(id => !players2.includes(id)), ...players1.filter(id => manager1.activeRoster.includes(id))],
            bench: [...m.bench.filter(id => !players2.includes(id)), ...players1.filter(id => manager1.bench.includes(id))],
          };
        }
        return m;
      }),
      activities: [newActivity, ...activities],
    });
  },
}));
