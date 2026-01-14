import { create } from 'zustand';

export interface Player {
  id: string;
  name: string;
  team: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
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
  updateScore: (managerId: string, points: number) => void;
  finalizeWeek: () => void;
  resetLeague: () => void;
  executeTrade: (manager1Id: string, manager2Id: string, players1: string[], players2: string[]) => void;
}

const IPL_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'PBKS', 'SRH', 'GT', 'LSG'];

const PLAYERS: Player[] = [
  { id: 'p1', name: 'MS Dhoni', team: 'CSK', role: 'Wicketkeeper', points: 0 },
  { id: 'p2', name: 'Virat Kohli', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'p3', name: 'Rohit Sharma', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'p4', name: 'Jasprit Bumrah', team: 'MI', role: 'Bowler', points: 0 },
  { id: 'p5', name: 'Rashid Khan', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'p6', name: 'Hardik Pandya', team: 'MI', role: 'All-rounder', points: 0 },
  { id: 'p7', name: 'Ravindra Jadeja', team: 'CSK', role: 'All-rounder', points: 0 },
  { id: 'p8', name: 'KL Rahul', team: 'LSG', role: 'Wicketkeeper', points: 0 },
  { id: 'p9', name: 'Rishabh Pant', team: 'DC', role: 'Wicketkeeper', points: 0 },
  { id: 'p10', name: 'Shubman Gill', team: 'GT', role: 'Batsman', points: 0 },
  { id: 'p11', name: 'Faf du Plessis', team: 'RCB', role: 'Batsman', points: 0 },
  { id: 'p12', name: 'Jos Buttler', team: 'RR', role: 'Wicketkeeper', points: 0 },
  { id: 'p13', name: 'Yuzvendra Chahal', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'p14', name: 'Mohammed Shami', team: 'GT', role: 'Bowler', points: 0 },
  { id: 'p15', name: 'Suryakumar Yadav', team: 'MI', role: 'Batsman', points: 0 },
  { id: 'p16', name: 'Andre Russell', team: 'KKR', role: 'All-rounder', points: 0 },
  { id: 'p17', name: 'Sunil Narine', team: 'KKR', role: 'All-rounder', points: 0 },
  { id: 'p18', name: 'Pat Cummins', team: 'SRH', role: 'Bowler', points: 0 },
  { id: 'p19', name: 'David Warner', team: 'DC', role: 'Batsman', points: 0 },
  { id: 'p20', name: 'Trent Boult', team: 'RR', role: 'Bowler', points: 0 },
  { id: 'p21', name: 'Ruturaj Gaikwad', team: 'CSK', role: 'Batsman', points: 0 },
  { id: 'p22', name: 'Ishan Kishan', team: 'MI', role: 'Wicketkeeper', points: 0 },
  { id: 'p23', name: 'Shreyas Iyer', team: 'KKR', role: 'Batsman', points: 0 },
  { id: 'p24', name: 'Sanju Samson', team: 'RR', role: 'Wicketkeeper', points: 0 },
  { id: 'p25', name: 'Mohammed Siraj', team: 'RCB', role: 'Bowler', points: 0 },
  { id: 'p26', name: 'Axar Patel', team: 'DC', role: 'All-rounder', points: 0 },
  { id: 'p27', name: 'Arshdeep Singh', team: 'PBKS', role: 'Bowler', points: 0 },
  { id: 'p28', name: 'Shikhar Dhawan', team: 'PBKS', role: 'Batsman', points: 0 },
  { id: 'p29', name: 'Glenn Maxwell', team: 'RCB', role: 'All-rounder', points: 0 },
  { id: 'p30', name: 'Mayank Agarwal', team: 'SRH', role: 'Batsman', points: 0 },
];

const MANAGERS: Manager[] = [
  { id: 'm1', name: 'Abhi', teamName: 'Abhi XI', wins: 0, losses: 0, points: 0, activeRoster: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'], bench: ['p12', 'p13', 'p14'] },
  { id: 'm2', name: 'Sahith', teamName: 'Sahith XI', wins: 0, losses: 0, points: 0, activeRoster: ['p15', 'p16', 'p17'], bench: [] },
  { id: 'm3', name: 'Jasthi', teamName: 'Jasthi XI', wins: 0, losses: 0, points: 0, activeRoster: ['p18', 'p19', 'p20'], bench: [] },
  { id: 'm4', name: 'Vamsi', teamName: 'Vamsi XI', wins: 0, losses: 0, points: 0, activeRoster: ['p21', 'p22', 'p23'], bench: [] },
  { id: 'm5', name: 'Krishna', teamName: 'Krishna XI', wins: 0, losses: 0, points: 0, activeRoster: ['p24', 'p25', 'p26'], bench: [] },
  { id: 'm6', name: 'Krithik', teamName: 'Krithik XI', wins: 0, losses: 0, points: 0, activeRoster: ['p27', 'p28', 'p29'], bench: [] },
  { id: 'm7', name: 'Akash', teamName: 'Akash XI', wins: 0, losses: 0, points: 0, activeRoster: ['p30'], bench: [] },
  { id: 'm8', name: 'Santosh', teamName: 'Santosh XI', wins: 0, losses: 0, points: 0, activeRoster: [], bench: [] },
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

const ACTIVITIES: Activity[] = [];

export const useGameStore = create<GameState>((set, get) => ({
  currentWeek: 1,
  currentManagerId: 'm1',
  managers: MANAGERS,
  players: PLAYERS,
  schedule: SCHEDULE,
  activities: ACTIVITIES,

  setCurrentManager: (id) => set({ currentManagerId: id }),

  addPlayer: (managerId, playerId) => {
    const { managers, players, activities } = get();
    const manager = managers.find(m => m.id === managerId);
    const player = players.find(p => p.id === playerId);
    
    if (!manager || !player) return;
    
    const totalPlayers = manager.activeRoster.length + manager.bench.length;
    if (totalPlayers >= 14) return;

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

  updateScore: (managerId, points) => {
    const { managers, activities } = get();
    const manager = managers.find(m => m.id === managerId);
    
    if (!manager) return;

    const newActivity: Activity = {
      id: `a${Date.now()}`,
      timestamp: new Date(),
      type: 'score',
      managerId,
      description: `Score adjusted for ${manager.teamName}: ${points > 0 ? '+' : ''}${points} pts`,
    };

    set({
      managers: managers.map(m => 
        m.id === managerId 
          ? { ...m, points: m.points + points }
          : m
      ),
      activities: [newActivity, ...activities],
    });
  },

  finalizeWeek: () => {
    const { currentWeek, schedule } = get();
    set({
      schedule: schedule.map(m => 
        m.week === currentWeek 
          ? { ...m, completed: true, homeScore: Math.floor(Math.random() * 100) + 100, awayScore: Math.floor(Math.random() * 100) + 100 }
          : m
      ),
      currentWeek: currentWeek + 1,
    });
  },

  resetLeague: () => {
    set({
      currentWeek: 1,
      managers: MANAGERS.map(m => ({ ...m, wins: 0, losses: 0, points: 0 })),
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
