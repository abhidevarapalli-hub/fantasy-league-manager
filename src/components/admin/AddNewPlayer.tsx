import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const IPL_TEAMS = ['MI', 'KKR', 'CSK', 'RR', 'RCB', 'DC', 'GT', 'LSG', 'PBKS', 'SRH'];

export const AddNewPlayer = () => {
  const addNewPlayer = useGameStore(state => state.addNewPlayer);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper' | ''>('');
  const [newPlayerIsInternational, setNewPlayerIsInternational] = useState(false);

  const handleAddNewPlayer = async () => {
    if (newPlayerName && newPlayerTeam && newPlayerRole) {
      await addNewPlayer(newPlayerName, newPlayerTeam, newPlayerRole, newPlayerIsInternational);
      setNewPlayerName('');
      setNewPlayerTeam('');
      setNewPlayerRole('');
      setNewPlayerIsInternational(false);
    }
  };

  return (
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
            <Select value={newPlayerRole} onValueChange={(v) => setNewPlayerRole(v as 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper')}>
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

        <div className="flex items-center gap-3">
          <Checkbox
            id="is-international"
            checked={newPlayerIsInternational}
            onCheckedChange={(checked) => setNewPlayerIsInternational(checked as boolean)}
          />
          <Label htmlFor="is-international" className="text-muted-foreground cursor-pointer">
            International Player
          </Label>
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
  );
};
