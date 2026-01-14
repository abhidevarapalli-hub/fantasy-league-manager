import { useState } from 'react';
import { Settings, Calculator, CheckCircle, ArrowLeftRight, AlertTriangle, Trash2 } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const Admin = () => {
  const { managers, players, currentWeek, updateScore, finalizeWeek, resetLeague, executeTrade } = useGameStore();
  
  const [selectedManager, setSelectedManager] = useState('');
  const [scoreAdjustment, setScoreAdjustment] = useState('');
  
  const [tradeManager1, setTradeManager1] = useState('');
  const [tradeManager2, setTradeManager2] = useState('');
  const [selectedPlayers1, setSelectedPlayers1] = useState<string[]>([]);
  const [selectedPlayers2, setSelectedPlayers2] = useState<string[]>([]);
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleScoreUpdate = () => {
    if (selectedManager && scoreAdjustment) {
      updateScore(selectedManager, parseInt(scoreAdjustment, 10));
      setScoreAdjustment('');
    }
  };

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
        {/* Score Adjustment */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Score Adjustment</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-2 block">Select Team</Label>
              <Select value={selectedManager} onValueChange={setSelectedManager}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.teamName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-muted-foreground mb-2 block">Points (+/-)</Label>
              <Input
                type="number"
                value={scoreAdjustment}
                onChange={(e) => setScoreAdjustment(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="e.g., 10 or -5"
                className="bg-muted border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            <Button 
              onClick={handleScoreUpdate}
              disabled={!selectedManager || !scoreAdjustment}
              className="w-full"
            >
              Apply Adjustment
            </Button>
          </div>
        </section>

        {/* Finalize Week */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-success" />
            <h2 className="font-semibold text-foreground">Finalize Week</h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Complete Week {currentWeek} and advance to the next round.
          </p>
          
          <Button 
            onClick={finalizeWeek}
            variant="outline"
            className="w-full border-success text-success hover:bg-success hover:text-success-foreground"
          >
            Finalize Week {currentWeek}
          </Button>
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
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset League
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                This will reset all standings, scores, and schedules. This action cannot be undone!
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
                  onClick={() => { resetLeague(); setShowResetConfirm(false); }}
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
