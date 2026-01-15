import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, TrendingUp, ArrowLeftRight, AlertTriangle, Trash2, UserPlus, Search } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const ROSTER_CAP = 14;

const Admin = () => {
  const [searchParams] = useSearchParams();
  const { managers, players, schedule, updateMatchScore, resetLeague, executeTrade, addFreeAgent, getFreeAgents, getManagerRosterCount } = useGameStore();
  
  const [tradeManager1, setTradeManager1] = useState('');
  const [tradeManager2, setTradeManager2] = useState('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Free Agent state
  const [faManager, setFaManager] = useState('');
  const [faSearch, setFaSearch] = useState('');
  const [faTeamFilter, setFaTeamFilter] = useState('all');
  const [selectedFreeAgent, setSelectedFreeAgent] = useState('');
  const [dropPlayerId, setDropPlayerId] = useState('');

  // Score Input state
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [matchScores, setMatchScores] = useState<Record<number, { home: string; away: string }>>({});

  // Pre-populate player from URL param
  useEffect(() => {
    const addPlayerId = searchParams.get('addPlayer');
    if (addPlayerId) {
      const player = players.find(p => p.id === addPlayerId);
      if (player) {
        setSelectedFreeAgent(addPlayerId);
        // Scroll to free agent section
        setTimeout(() => {
          document.getElementById('free-agent-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [searchParams, players]);

  // Initialize match scores when week changes
  useEffect(() => {
    const weekNum = parseInt(selectedWeek);
    const weekMatches = schedule.filter(m => m.week === weekNum);
    const initialScores: Record<number, { home: string; away: string }> = {};
    weekMatches.forEach((match, idx) => {
      initialScores[idx] = {
        home: match.homeScore?.toString() || '',
        away: match.awayScore?.toString() || '',
      };
    });
    setMatchScores(initialScores);
  }, [selectedWeek, schedule]);

  const handleTrade = () => {
    if (tradeManager1 && tradeManager2 && selectedPlayers1.length > 0 && selectedPlayers2.length > 0) {
      executeTrade(tradeManager1, tradeManager2, selectedPlayers1, selectedPlayers2);
      setTradeManager1('');
      setTradeManager2('');
      setSelectedPlayers1([]);
      setSelectedPlayers2([]);
    }
  };

  const manager1 = managers.find(m => m.id === tradeManager1);
  const manager2 = managers.find(m => m.id === tradeManager2);
  
  const manager1Players = manager1 
    ? [...manager1.activeRoster, ...manager1.bench].map(id => players.find(p => p.id === id)!).filter(Boolean)
    : [];
  const manager2Players = manager2 
    ? [...manager2.activeRoster, ...manager2.bench].map(id => players.find(p => p.id === id)!).filter(Boolean)
    : [];

  // Free Agent logic
  const freeAgents = getFreeAgents();
  const faManagerData = managers.find(m => m.id === faManager);
  const faRosterCount = faManager ? getManagerRosterCount(faManager) : 0;
  const isAtCap = faRosterCount >= ROSTER_CAP;

  const faManagerPlayers = faManagerData 
    ? [...faManagerData.activeRoster, ...faManagerData.bench].map(id => players.find(p => p.id === id)!).filter(Boolean)
    : [];

  const uniqueTeams = useMemo(() => {
    const teams = new Set(freeAgents.map(p => p.team));
    return Array.from(teams).sort();
  }, [freeAgents]);

  const filteredFreeAgents = useMemo(() => {
    return freeAgents.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(faSearch.toLowerCase());
      const matchesTeam = faTeamFilter === 'all' || p.team === faTeamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [freeAgents, faSearch, faTeamFilter]);

  const handleAddFreeAgent = () => {
    if (faManager && selectedFreeAgent) {
      if (isAtCap && !dropPlayerId) return;
      addFreeAgent(faManager, selectedFreeAgent, isAtCap ? dropPlayerId : undefined);
      setSelectedFreeAgent('');
      setDropPlayerId('');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Batsman': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Bowler': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'All Rounder': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Wicket Keeper': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Score Input Logic
  const weekNum = parseInt(selectedWeek);
  const weekMatches = schedule.filter(m => m.week === weekNum);

  const handleScoreChange = (matchIndex: number, team: 'home' | 'away', value: string) => {
    setMatchScores(prev => ({
      ...prev,
      [matchIndex]: {
        ...prev[matchIndex],
        [team]: value,
      },
    }));

    // Auto-save when both scores are entered
    const otherTeam = team === 'home' ? 'away' : 'home';
    const otherValue = matchScores[matchIndex]?.[otherTeam];
    
    if (value && otherValue) {
      const homeScore = team === 'home' ? parseInt(value) : parseInt(otherValue);
      const awayScore = team === 'away' ? parseInt(value) : parseInt(otherValue);
      
      if (!isNaN(homeScore) && !isNaN(awayScore)) {
        updateMatchScore(weekNum, matchIndex, homeScore, awayScore);
      }
    }
  };

  const handleScoreBlur = (matchIndex: number) => {
    const scores = matchScores[matchIndex];
    if (scores?.home && scores?.away) {
      const homeScore = parseInt(scores.home);
      const awayScore = parseInt(scores.away);
      
      if (!isNaN(homeScore) && !isNaN(awayScore)) {
        updateMatchScore(weekNum, matchIndex, homeScore, awayScore);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Admin Suite</h1>
            <p className="text-xs text-muted-foreground">League management tools</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Score Input */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground italic">Score Input</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Select Week</span>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-28 bg-primary/10 border-primary/30 text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map(week => (
                    <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Week {selectedWeek} Matchups
            </h3>
            
            {weekMatches.map((match, idx) => {
              const homeManager = managers.find(m => m.id === match.home);
              const awayManager = managers.find(m => m.id === match.away);
              
              return (
                <div key={idx} className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground w-20 text-right">
                      {homeManager?.teamName}
                    </span>
                    <Input
                      type="number"
                      value={matchScores[idx]?.home || ''}
                      onChange={(e) => handleScoreChange(idx, 'home', e.target.value)}
                      onBlur={() => handleScoreBlur(idx)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-20 text-center text-lg font-bold bg-muted border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs text-muted-foreground uppercase">vs</span>
                    <Input
                      type="number"
                      value={matchScores[idx]?.away || ''}
                      onChange={(e) => handleScoreChange(idx, 'away', e.target.value)}
                      onBlur={() => handleScoreBlur(idx)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-20 text-center text-lg font-bold bg-muted border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-sm font-medium text-foreground w-20">
                      {awayManager?.teamName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Free Agent Management */}
        <section id="free-agent-section" className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-secondary" />
            <h2 className="font-semibold text-foreground">Add Free Agent</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-2 block">Select Team</Label>
              <Select value={faManager} onValueChange={(v) => { setFaManager(v); setDropPlayerId(''); }}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map(m => {
                    const count = getManagerRosterCount(m.id);
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {m.teamName} ({count}/{ROSTER_CAP})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {faManager && (
              <>
                {isAtCap && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm text-destructive font-medium mb-2">
                      Roster is full! Select a player to drop:
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {faManagerPlayers.map(player => (
                        <label 
                          key={player.id} 
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            dropPlayerId === player.id 
                              ? 'bg-destructive/20 border border-destructive/50' 
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          <input
                            type="radio"
                            name="dropPlayer"
                            checked={dropPlayerId === player.id}
                            onChange={() => setDropPlayerId(player.id)}
                            className="accent-destructive"
                          />
                          <span className="text-sm truncate flex-1">{player.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getRoleBadgeColor(player.role)}`}>
                            {player.team}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search players..."
                      value={faSearch}
                      onChange={(e) => setFaSearch(e.target.value)}
                      className="pl-9 bg-muted border-border"
                    />
                  </div>
                  <Select value={faTeamFilter} onValueChange={setFaTeamFilter}>
                    <SelectTrigger className="w-24 bg-muted border-border">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueTeams.map(team => (
                        <SelectItem key={team} value={team}>{team}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredFreeAgents.slice(0, 50).map(player => (
                    <label 
                      key={player.id} 
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedFreeAgent === player.id 
                          ? 'bg-primary/20 border border-primary/50' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <input
                        type="radio"
                        name="freeAgent"
                        checked={selectedFreeAgent === player.id}
                        onChange={() => setSelectedFreeAgent(player.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm truncate flex-1">{player.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${getRoleBadgeColor(player.role)}`}>
                        {player.role}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {player.team}
                      </Badge>
                    </label>
                  ))}
                  {filteredFreeAgents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No free agents found</p>
                  )}
                </div>

                <Button 
                  onClick={handleAddFreeAgent}
                  disabled={!selectedFreeAgent || (isAtCap && !dropPlayerId)}
                  className="w-full"
                >
                  {isAtCap ? 'Drop & Add Player' : 'Add Player'}
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Trade Hub */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-secondary" />
            <h2 className="font-semibold text-foreground">Trade Hub</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-muted-foreground mb-2 block text-xs">Team 1</Label>
              <Select value={tradeManager1} onValueChange={(v) => { setTradeManager1(v); setSelectedPlayers1([]); }}>
                <SelectTrigger className="bg-muted border-border text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {managers.filter(m => m.id !== tradeManager2).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.teamName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-muted-foreground mb-2 block text-xs">Team 2</Label>
              <Select value={tradeManager2} onValueChange={(v) => { setTradeManager2(v); setSelectedPlayers2([]); }}>
                <SelectTrigger className="bg-muted border-border text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {managers.filter(m => m.id !== tradeManager1).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.teamName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tradeManager1 && tradeManager2 && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{manager1?.teamName} gives:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {manager1Players.map(player => (
                    <label key={player.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                      <Checkbox
                        checked={selectedPlayers1.includes(player.id)}
                        onCheckedChange={(checked) => {
                          setSelectedPlayers1(prev => 
                            checked ? [...prev, player.id] : prev.filter(id => id !== player.id)
                          );
                        }}
                      />
                      <span className="text-xs truncate">{player.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{manager2?.teamName} gives:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {manager2Players.map(player => (
                    <label key={player.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80">
                      <Checkbox
                        checked={selectedPlayers2.includes(player.id)}
                        onCheckedChange={(checked) => {
                          setSelectedPlayers2(prev => 
                            checked ? [...prev, player.id] : prev.filter(id => id !== player.id)
                          );
                        }}
                      />
                      <span className="text-xs truncate">{player.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <Button 
            onClick={handleTrade}
            disabled={selectedPlayers1.length === 0 || selectedPlayers2.length === 0}
            variant="secondary"
            className="w-full"
          >
            Execute Trade
          </Button>
        </section>

        {/* Danger Zone */}
        <section className="bg-card rounded-xl border border-destructive/30 p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="font-semibold text-destructive">Danger Zone</h2>
          </div>
          
          {!showResetConfirm ? (
            <Button 
              onClick={() => setShowResetConfirm(true)}
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset League
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                ⚠️ This will reset all standings, scores, rosters, and activities. This cannot be undone!
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowResetConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    resetLeague();
                    setShowResetConfirm(false);
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  Confirm Reset
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Admin;
