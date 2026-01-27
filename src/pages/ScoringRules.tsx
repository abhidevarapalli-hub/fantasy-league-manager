import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Zap, Shield, Save } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ScoringRules as ScoringRulesType } from '@/lib/scoring-types';

const ScoringRules = () => {
  const navigate = useNavigate();
  const scoringRules = useGameStore((state) => state.scoringRules);
  const updateScoringRules = useGameStore((state) => state.updateScoringRules);
  const gameLoading = useGameStore((state) => state.loading);
  const isLeagueManager = useAuthStore((state) => state.isLeagueManager());

  // Local state for form
  const [rules, setRules] = useState<ScoringRulesType>(scoringRules);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when scoringRules from context changes
  useEffect(() => {
    setRules(scoringRules);
  }, [scoringRules]);

  // If not league manager, redirect home
  useEffect(() => {
    if (!gameLoading && !isLeagueManager) {
      navigate('/');
    }
  }, [isLeagueManager, gameLoading, navigate]);

  // Update local state and track changes
  const handleBattingChange = (field: keyof ScoringRulesType['batting'], value: number) => {
    setRules(prev => ({
      ...prev,
      batting: { ...prev.batting, [field]: value }
    }));
    setHasChanges(true);
  };

  const handleBowlingChange = (field: keyof ScoringRulesType['bowling'], value: number) => {
    setRules(prev => ({
      ...prev,
      bowling: { ...prev.bowling, [field]: value }
    }));
    setHasChanges(true);
  };

  const handleFieldingChange = (field: keyof ScoringRulesType['fielding'], value: number) => {
    setRules(prev => ({
      ...prev,
      fielding: { ...prev.fielding, [field]: value }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateScoringRules(rules);
    setSaving(false);

    if (result.success) {
      toast.success('Scoring rules updated successfully');
      setHasChanges(false);
    } else {
      toast.error(result.error || 'Failed to update scoring rules');
    }
  };

  // Show loading state
  if (gameLoading) {
    return (
      <AppLayout title="Scoring Rules" subtitle="Configure fantasy point values">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-medium animate-pulse">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Scoring Rules" subtitle="Configure fantasy point values">
      <div className="px-4 py-4 space-y-6">
        {/* Batting Points */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-foreground">Batting Points</h2>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Points per Run</Label>
                <Input
                  type="number"
                  value={rules.batting.runs}
                  onChange={(e) => handleBattingChange('runs', parseInt(e.target.value) || 0)}
                  placeholder="1"
                  className="bg-card border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Default: 1 point per run</p>
              </div>

              {/* Future extension slots */}
              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Bonus per Four</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Additional bonus for boundaries</p>
              </div>

              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Bonus per Six</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Additional bonus for sixes</p>
              </div>

              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Half Century Bonus</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Bonus for scoring 50+ runs</p>
              </div>
            </div>
          </div>
        </section>

        {/* Bowling Points */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold text-foreground">Bowling Points</h2>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Points per Wicket</Label>
                <Input
                  type="number"
                  value={rules.bowling.wickets}
                  onChange={(e) => handleBowlingChange('wickets', parseInt(e.target.value) || 0)}
                  placeholder="25"
                  className="bg-card border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Default: 25 points per wicket</p>
              </div>

              {/* Future extension slots */}
              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Points per Maiden</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Bonus for bowling maiden overs</p>
              </div>

              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Hat-trick Bonus</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Bonus for taking 3 wickets in 3 balls</p>
              </div>

              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">5 Wicket Haul Bonus</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Bonus for taking 5+ wickets</p>
              </div>
            </div>
          </div>
        </section>

        {/* Fielding Points */}
        <section className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-foreground">Fielding Points</h2>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Points per Catch</Label>
                <Input
                  type="number"
                  value={rules.fielding.catches}
                  onChange={(e) => handleFieldingChange('catches', parseInt(e.target.value) || 0)}
                  placeholder="8"
                  className="bg-card border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Default: 8 points per catch</p>
              </div>

              {/* Future extension slots */}
              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Points per Stumping</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Points for wicket keeper stumpings</p>
              </div>

              <div className="opacity-50">
                <Label className="text-muted-foreground mb-2 block">Points per Run Out</Label>
                <Input
                  type="number"
                  disabled
                  placeholder="Coming soon"
                  className="bg-card border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">Points for direct hit run outs</p>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="shadow-lg"
            size="lg"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ScoringRules;
