import { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'Batsman': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Bowler': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'All Rounder': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Wicket Keeper': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const RemovePlayer = () => {
  const players = useGameStore(state => state.players);
  const managers = useGameStore(state => state.managers);
  const removePlayerFromLeague = useGameStore(state => state.removePlayerFromLeague);

  const [removePlayerTeamFilter, setRemovePlayerTeamFilter] = useState('all');
  const [selectedRemovePlayer, setSelectedRemovePlayer] = useState('none');
  const [showRemovePlayerConfirm, setShowRemovePlayerConfirm] = useState(false);

  const allUniqueTeams = useMemo(() => {
    const teams = new Set(players.map(p => p.team));
    return Array.from(teams).sort();
  }, [players]);

  const filteredPlayersForRemoval = useMemo(() => {
    return players.filter(p => {
      return removePlayerTeamFilter === 'all' || p.team === removePlayerTeamFilter;
    });
  }, [players, removePlayerTeamFilter]);

  const playerToRemove = players.find(p => p.id === selectedRemovePlayer);
  const playerOwner = playerToRemove ? managers.find(m =>
    m.activeRoster.includes(selectedRemovePlayer) || m.bench.includes(selectedRemovePlayer)
  ) : null;

  const handleRemovePlayerFromLeague = async () => {
    if (selectedRemovePlayer === 'none') return;
    await removePlayerFromLeague(selectedRemovePlayer);
    setSelectedRemovePlayer('none');
    setShowRemovePlayerConfirm(false);
  };

  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-destructive" />
        <h2 className="font-semibold text-foreground">Remove Player from League</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground mb-2 block">Filter by Team</Label>
          <Select value={removePlayerTeamFilter} onValueChange={setRemovePlayerTeamFilter}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {allUniqueTeams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-muted-foreground mb-2 block">Select Player to Remove</Label>
          <Select value={selectedRemovePlayer} onValueChange={setSelectedRemovePlayer}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder="Select a player" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="none">-- Select Player --</SelectItem>
              {filteredPlayersForRemoval.slice(0, 100).map(player => (
                <SelectItem key={player.id} value={player.id}>
                  {player.name} ({player.team} - {player.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {playerToRemove && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{playerToRemove.name}</p>
                <p className="text-sm text-muted-foreground">
                  {playerToRemove.team} • {playerToRemove.role}
                  {playerToRemove.isInternational && ' • International'}
                </p>
                {playerOwner && (
                  <p className="text-sm text-destructive mt-1">
                    ⚠️ Currently on {playerOwner.teamName}'s roster
                  </p>
                )}
              </div>
              <Badge className={getRoleBadgeColor(playerToRemove.role)}>
                {playerToRemove.role}
              </Badge>
            </div>
          </div>
        )}

        {!showRemovePlayerConfirm ? (
          <Button
            onClick={() => setShowRemovePlayerConfirm(true)}
            disabled={selectedRemovePlayer === 'none'}
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove from League
          </Button>
        ) : (
          <div className="space-y-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
            <p className="text-sm text-destructive">
              ⚠️ Are you sure you want to remove <strong>{playerToRemove?.name}</strong> from the league?
              {playerOwner && ` They will be removed from ${playerOwner.teamName}'s roster.`}
              {' '}This cannot be undone!
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowRemovePlayerConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemovePlayerFromLeague}
                variant="destructive"
                className="flex-1"
              >
                Confirm Remove
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
