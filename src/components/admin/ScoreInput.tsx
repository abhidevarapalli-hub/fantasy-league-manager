import { useState, useEffect } from 'react';
import { TrendingUp, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ScoreInput = () => {
  const managers = useGameStore(state => state.managers);
  const schedule = useGameStore(state => state.schedule);
  const updateMatchScore = useGameStore(state => state.updateMatchScore);
  const finalizeWeekScores = useGameStore(state => state.finalizeWeekScores);

  const [selectedWeek, setSelectedWeek] = useState('1');
  const [matchScores, setMatchScores] = useState<Record<number, { home: string; away: string }>>({});

  const weekNum = parseInt(selectedWeek);
  const weekMatches = schedule.filter(m => m.week === weekNum);

  useEffect(() => {
    const initialScores: Record<number, { home: string; away: string }> = {};
    weekMatches.forEach((match, idx) => {
      initialScores[idx] = {
        home: match.homeScore?.toString() || '',
        away: match.awayScore?.toString() || '',
      };
    });
    setMatchScores(initialScores);
  }, [selectedWeek, schedule, weekMatches]);

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

  const handleFinalizeWeek = async () => {
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
    await finalizeWeekScores(weekNum);
    toast.success(`Week ${weekNum} scores finalized`);
  };

  return (
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
              {Array.from({ length: Math.max(7, ...schedule.map(m => m.week)) }).map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  Week {i + 1}
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
  );
};
