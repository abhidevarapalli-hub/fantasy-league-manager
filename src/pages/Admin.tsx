import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings, TrendingUp, ArrowLeftRight, AlertTriangle, Trash2, UserPlus, Search, Plus, Check } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const ROSTER_CAP = 14;
const IPL_TEAMS = ['MI', 'KKR', 'CSK', 'RR', 'RCB', 'DC', 'GT', 'LSG', 'PBKS', 'SRH'];

const Admin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { 
    managers, 
    players, 
    schedule, 
    updateMatchScore, 
    finalizeWeekScores,
    resetLeague, 
    executeTrade, 
    addFreeAgent, 
    getFreeAgents, 
    getManagerRosterCount,
    addNewPlayer,
    dropPlayerOnly,
  } = useGame();
  
  const [tradeManager1, setTradeManager1] = useState('');
  const [tradeManager2, setTradeManager2] = useState('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Roster Management state
  const [rmManager, setRmManager] = useState('');
  const [rmDropPlayer, setRmDropPlayer] = useState('none');
  const [rmAddPlayer, setRmAddPlayer] = useState('none');
  const [faSearch, setFaSearch] = useState('');
  const [faTeamFilter, setFaTeamFilter] = useState('all');

  // Score Input state
  const [selectedWeek, setSelectedWeek] = useState('1');
  const [matchScores, setMatchScores] = useState<Record<number, { home: string; away: string }>>({});

  // Add New Player state
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper' | ''>('');

  // Pre-populate player from URL param
  useEffect(() => {
    const addPlayerId = searchParams.get('addPlayer');
    if (addPlayerId) {
      const player = players.find(p => p.id === addPlayerId);
      if (player) {
        setRmAddPlayer(addPlayerId);
        // Clear the URL param
        navigate('/admin', { replace: true });
        // Scroll to roster management section
        setTimeout(() => {
          document.getElementById('roster-management-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [searchParams, players, navigate]);

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

  // Roster Management logic
  const freeAgents = getFreeAgents();
  const rmManagerData = managers.find(m => m.id === rmManager);
  const rmRosterCount = rmManager ? getManagerRosterCount(rmManager) : 0;
  const isAtCap = rmRosterCount >= ROSTER_CAP;
  const hasPlayers = rmRosterCount > 0;

  const rmManagerPlayers = rmManagerData 
    ? [...rmManagerData.activeRoster, ...rmManagerData.bench].map(id => players.find(p => p.id === id)!).filter(Boolean)
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

  // Determine what actions are possible
  const canAddOnly = rmManager && !isAtCap && rmAddPlayer !== 'none';
  const canDropOnly = rmManager && hasPlayers && rmDropPlayer !== 'none' && rmAddPlayer === 'none';
  const canAddAndDrop = rmManager && rmAddPlayer !== 'none' && rmDropPlayer !== 'none';

  const handleExecuteRosterMove = () => {
    if (!rmManager) return;

    if (canAddAndDrop) {
      // Add & Drop
      addFreeAgent(rmManager, rmAddPlayer, rmDropPlayer);
    } else if (canAddOnly) {
      // Add only
      addFreeAgent(rmManager, rmAddPlayer);
    } else if (canDropOnly) {
      // Drop only
      dropPlayerOnly(rmManager, rmDropPlayer);
    }

    // Reset selections
    setRmDropPlayer('none');
    setRmAddPlayer('none');
  };

  const getButtonLabel = () => {
    if (canAddAndDrop) return 'Add & Drop Player';
    if (canAddOnly) return 'Add Player';
    if (canDropOnly) return 'Drop Player';
    return 'Execute Roster Move';
  };

  const isButtonEnabled = canAddOnly || canDropOnly || canAddAndDrop;

  const handleAddNewPlayer = () => {
    if (newPlayerName && newPlayerTeam && newPlayerRole) {
      addNewPlayer(newPlayerName, newPlayerTeam, newPlayerRole);
      setNewPlayerName('');
      setNewPlayerTeam('');
      setNewPlayerRole('');
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
  const allScoresEntered = weekMatches.every((_, idx) => 
    matchScores[idx]?.home && matchScores[idx]?.away
  );

  const handleScoreChange = (matchIndex: number, team: 'home' | 'away', value: string) => {
    setMatchScores(prev => ({
      ...prev,
      [matchIndex]: {
        ...prev[matchIndex],
        [team]: value,
      },
    }));
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

  const handleFinalizeWeek = () => {
    // Save all scores first
    weekMatches.forEach((_, idx) => {
      const scores = matchScores[idx];
      if (scores?.home && scores?.away) {
        const homeScore = parseInt(scores.home);
        const awayScore = parseInt(scores.away);
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
          updateMatchScore(weekNum, idx, homeScore, awayScore);
        }
      }
    });
    // Then finalize
    finalizeWeekScores(weekNum);
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
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
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

            <Button 
              onClick={handleFinalizeWeek}
              disabled={!allScoresEntered}
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Finalize Week {selectedWeek}
            </Button>
          </div>
        </section>

        {/* Add New Player */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Add New Player</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-2 block">Player Name</Label>
              <Input
                placeholder="Enter player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="bg-muted border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">IPL Team</Label>
                <Select value={newPlayerTeam} onValueChange={setNewPlayerTeam}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {IPL_TEAMS.map(team => (
                      <SelectItem key={team} value={team}>{team}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Position</Label>
                <Select value={newPlayerRole} onValueChange={(v) => setNewPlayerRole(v as any)}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Batsman">Batsman</SelectItem>
                    <SelectItem value="Bowler">Bowler</SelectItem>
                    <SelectItem value="All Rounder">All Rounder</SelectItem>
                    <SelectItem value="Wicket Keeper">Wicket Keeper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleAddNewPlayer}
              disabled={!newPlayerName || !newPlayerTeam || !newPlayerRole}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Player to Pool
            </Button>
          </div>
        </section>

        {/* Roster Management */}
        <section id="roster-management-section" className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground italic">Roster Management</h2>
          </div>
          
          <div className="space-y-4">
            {/* Three dropdowns in a row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Manager */}
              <div>
                <Label className="text-muted-foreground mb-2 block uppercase text-xs tracking-wider">Select Manager</Label>
                <Select value={rmManager} onValueChange={(v) => { setRmManager(v); setRmDropPlayer('none'); setRmAddPlayer('none'); }}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Choose manager" />
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

              {/* Drop (Optional) - Only show if manager has players */}
              {rmManager && hasPlayers && (
                <div>
                  <Label className="text-muted-foreground mb-2 block uppercase text-xs tracking-wider">Drop (Optional)</Label>
                  <Select value={rmDropPlayer} onValueChange={setRmDropPlayer}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Select player to drop" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Drop (Direct Add)</SelectItem>
                      {rmManagerPlayers.map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} ({player.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Add from Pool - Only show if not at cap OR if dropping */}
              {rmManager && (!isAtCap || rmDropPlayer !== 'none') && (
                <div>
                  <Label className="text-muted-foreground mb-2 block uppercase text-xs tracking-wider">Add from Pool</Label>
                  <Select value={rmAddPlayer} onValueChange={setRmAddPlayer}>
                    <SelectTrigger className="bg-muted border-border">
                      <SelectValue placeholder="Select player to add" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="none">No Add (Drop Only)</SelectItem>
                      {filteredFreeAgents.slice(0, 100).map(player => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.name} ({player.team} - {player.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Search/Filter for free agents */}
            {rmManager && (!isAtCap || rmDropPlayer !== 'none') && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search free agents..."
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
            )}

            {/* Status message */}
            {rmManager && isAtCap && rmDropPlayer === 'none' && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-sm text-destructive">
                  Roster is full ({rmRosterCount}/{ROSTER_CAP}). Select a player to drop to add someone new.
                </p>
              </div>
            )}

            {/* Selected player preview */}
            {rmAddPlayer !== 'none' && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                <p className="text-sm text-primary">
                  Adding: {players.find(p => p.id === rmAddPlayer)?.name}
                  {rmDropPlayer !== 'none' && (
                    <> | Dropping: {players.find(p => p.id === rmDropPlayer)?.name}</>
                  )}
                </p>
              </div>
            )}

            {rmDropPlayer !== 'none' && rmAddPlayer === 'none' && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-sm text-destructive">
                  Dropping: {players.find(p => p.id === rmDropPlayer)?.name}
                </p>
              </div>
            )}

            {/* Execute Button */}
            <Button 
              onClick={handleExecuteRosterMove}
              disabled={!isButtonEnabled}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              variant="outline"
            >
              {getButtonLabel()}
            </Button>
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