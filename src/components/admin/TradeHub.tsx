import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export const TradeHub = () => {
  const managers = useGameStore(state => state.managers);
  const players = useGameStore(state => state.players);
  const executeTrade = useGameStore(state => state.executeTrade);

  const [tradeManager1, setTradeManager1] = useState('');
  const [tradeManager2, setTradeManager2] = useState('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);

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

  return (
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
  );
};
