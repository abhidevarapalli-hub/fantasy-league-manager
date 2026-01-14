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
  { id: 'm1', name: 'You', teamName: 'Thunder Warriors', wins: 3, losses: 1, points: 6, activeRoster: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'], bench: ['p12', 'p13', 'p14'] },
  { id: 'm2', name: 'Rahul', teamName: 'Royal Strikers', wins: 2, losses: 2, points: 4, activeRoster: ['p15', 'p16', 'p17'], bench: [] },
  { id: 'm3', name: 'Priya', teamName: 'Super Kings XI', wins: 3, losses: 1, points: 6, activeRoster: ['p18', 'p19', 'p20'], bench: [] },
  { id: 'm4', name: 'Arjun', teamName: 'Titans United', wins: 1, losses: 3, points: 2, activeRoster: ['p21', 'p22', 'p23'], bench: [] },
  { id: 'm5', name: 'Sneha', teamName: 'Galaxy Riders', wins: 2, losses: 2, points: 4, activeRoster: ['p24', 'p25', 'p26'], bench: [] },
  { id: 'm6', name: 'Vikram', teamName: 'Storm Chasers', wins: 1, losses: 3, points: 2, activeRoster: ['p27', 'p28', 'p29'], bench: [] },
];

const SCHEDULE: Match[] = [
  { week: 1, home: 'm1', away: 'm2', homeScore: 156, awayScore: 142, completed: true },
  { week: 1, home: 'm3', away: 'm4', homeScore: 178, awayScore: 165, completed: true },
  { week: 1, home: 'm5', away: 'm6', homeScore: 134, awayScore: 145, completed: true },
  { week: 2, home: 'm1', away: 'm3', homeScore: 189, awayScore: 176, completed: true },
  { week: 2, home: 'm2', away: 'm5', homeScore: 167, awayScore: 158, completed: true },
  { week: 2, home: 'm4', away: 'm6', homeScore: 143, awayScore: 156, completed: true },
  { week: 3, home: 'm1', away: 'm4', homeScore: 201, awayScore: 178, completed: true },
  { week: 3, home: 'm2', away: 'm6', homeScore: 145, awayScore: 167, completed: true },
  { week: 3, home: 'm3', away: 'm5', homeScore: 189, awayScore: 176, completed: true },
  { week: 4, home: 'm1', away: 'm5', homeScore: 156, awayScore: 178, completed: true },
  { week: 4, home: 'm2', away: 'm4', homeScore: 189, awayScore: 167, completed: true },
  { week: 4, home: 'm3', away: 'm6', homeScore: 201, awayScore: 156, completed: true },
  { week: 5, home: 'm1', away: 'm6', completed: false },
  { week: 5, home: 'm2', away: 'm3', completed: false },
  { week: 5, home: 'm4', away: 'm5', completed: false },
  { week: 6, home: 'm2', away: 'm1', completed: false },
  { week: 6, home: 'm4', away: 'm3', completed: false },
  { week: 6, home: 'm6', away: 'm5', completed: false },
  { week: 7, home: 'm3', away: 'm1', completed: false },
  { week: 7, home: 'm5', away: 'm2', completed: false },
  { week: 7, home: 'm6', away: 'm4', completed: false },
];

const ACTIVITIES: Activity[] = [
  { id: 'a1', timestamp: new Date(Date.now() - 3600000), type: 'add', managerId: 'm1', description: 'Thunder Warriors added Jos Buttler' },
  { id: 'a2', timestamp: new Date(Date.now() - 7200000), type: 'drop', managerId: 'm2', description: 'Royal Strikers dropped Mayank Agarwal' },
  { id: 'a3', timestamp: new Date(Date.now() - 10800000), type: 'trade', managerId: 'm3', description: 'Super Kings XI traded Pat Cummins to Titans United for Rashid Khan' },
  { id: 'a4', timestamp: new Date(Date.now() - 86400000), type: 'score', managerId: 'm1', description: 'Week 4 scores updated: Thunder Warriors 156 pts' },
];

export const useGameStore = create<GameState>((set, get) => ({
  currentWeek: 5,
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
