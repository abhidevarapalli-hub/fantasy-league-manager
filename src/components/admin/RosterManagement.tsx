import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const RosterManagement = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const config = useGameStore(state => state.config);
  const addFreeAgent = useGameStore(state => state.addFreeAgent);
  const getFreeAgents = useGameStore(state => state.getFreeAgents);
  const getManagerRosterCount = useGameStore(state => state.getManagerRosterCount);
  const dropPlayerOnly = useGameStore(state => state.dropPlayerOnly);

  const ROSTER_CAP = config.activeSize + config.benchSize;

  const [rmManager, setRmManager] = useState('');
  const [rmDropPlayer, setRmDropPlayer] = useState('none');
  const [rmAddPlayer, setRmAddPlayer] = useState('none');
  const [faSearch] = useState('');
  const [faTeamFilter] = useState('all');

  // Pre-populate player from URL param
  useEffect(() => {
    const addPlayerId = searchParams.get('addPlayer');
    if (addPlayerId) {
      const player = players.find(p => p.id === addPlayerId);
      if (player) {
        setRmAddPlayer(addPlayerId);
        navigate(window.location.pathname, { replace: true });
        setTimeout(() => {
          document.getElementById('roster-management-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [searchParams, players, navigate]);

  const freeAgents = getFreeAgents();
  const rmManagerData = managers.find(m => m.id === rmManager);
  const rmRosterCount = rmManager ? getManagerRosterCount(rmManager) : 0;
  const isAtCap = rmRosterCount >= ROSTER_CAP;
  const hasPlayers = rmRosterCount > 0;

  const rmManagerPlayers = rmManagerData
    ? [...rmManagerData.activeRoster, ...rmManagerData.bench].map(id => players.find(p => p.id === id)!).filter(Boolean)
    : [];

  const filteredFreeAgents = useMemo(() => {
    return freeAgents.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(faSearch.toLowerCase());
      const matchesTeam = faTeamFilter === 'all' || p.team === faTeamFilter;
      return matchesSearch && matchesTeam;
    });
  }, [freeAgents, faSearch, faTeamFilter]);

  const canAddOnly = rmManager && !isAtCap && rmAddPlayer !== 'none';
  const canDropOnly = rmManager && hasPlayers && rmDropPlayer !== 'none' && rmAddPlayer === 'none';
  const canAddAndDrop = rmManager && rmAddPlayer !== 'none' && rmDropPlayer !== 'none';

  const handleExecuteRosterMove = () => {
    if (!rmManager) return;

    if (canAddAndDrop) {
      addFreeAgent(rmManager, rmAddPlayer, rmDropPlayer);
    } else if (canAddOnly) {
      addFreeAgent(rmManager, rmAddPlayer);
    } else if (canDropOnly) {
      dropPlayerOnly(rmManager, rmDropPlayer);
    }

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

  return (
    <section id="roster-management-section" className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <ArrowLeftRight className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground italic">Roster Management</h2>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {rmManager && isAtCap && rmDropPlayer === 'none' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <p className="text-sm text-destructive">
              Roster is full ({rmRosterCount}/{ROSTER_CAP}). Select a player to drop to add someone new.
            </p>
          </div>
        )}

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
  );
};
