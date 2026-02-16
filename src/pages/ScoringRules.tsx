import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Zap,
  Shield,
  Save,
  Settings,
  Trophy,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ScoringRules as ScoringRulesType } from '@/lib/scoring-types';
import { cn } from '@/lib/utils';

const NumericField = ({ label, value, onChange, description, className, disabled }: any) => (
  <div className={cn("space-y-2", className)}>
    {label && <Label className="text-sm font-medium">{label}</Label>}
    <Input
      type="number"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
      className="h-10"
    />
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
);

const ScoringRules = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // If not league manager, they can only view
  useEffect(() => {
    if (!gameLoading && !isLeagueManager) {
      // We stay on the page now, but inputs will be disabled
      console.log('User is not a league manager, viewing in read-only mode');
    }
  }, [isLeagueManager, gameLoading]);

  // Generic change handlers
  const updateNestedField = (category: keyof ScoringRulesType, field: string, value: any) => {
    if (!isLeagueManager) return;
    setRules(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
    setHasChanges(true);
  };

  const updateMilestone = (category: 'batting' | 'bowling', index: number, field: string, value: any) => {
    if (!isLeagueManager) return;
    const newMilestones = [...rules[category].milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    updateNestedField(category, 'milestones', newMilestones);
  };

  const addMilestone = (category: 'batting' | 'bowling') => {
    if (!isLeagueManager) return;
    const newMilestones = [...rules[category].milestones, { [category === 'batting' ? 'runs' : 'wickets']: 0, points: 0 }];
    updateNestedField(category, 'milestones', newMilestones);
  };

  const removeMilestone = (category: 'batting' | 'bowling', index: number) => {
    if (!isLeagueManager) return;
    const newMilestones = rules[category].milestones.filter((_, i) => i !== index);
    updateNestedField(category, 'milestones', newMilestones);
  };

  const updateRateBonus = (category: 'batting' | 'bowling', index: number, field: string, value: any) => {
    if (!isLeagueManager) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const newBonuses = [...(rules[category] as any)[fieldName]];
    newBonuses[index] = { ...newBonuses[index], [field]: value };
    updateNestedField(category, fieldName, newBonuses);
  };

  const addRateBonus = (category: 'batting' | 'bowling') => {
    if (!isLeagueManager) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const defaultValue = category === 'batting'
      ? { minSR: 0, maxSR: 0, points: 0, minBalls: 10 }
      : { minER: 0, maxER: 0, points: 0, minOvers: 2 };
    const newBonuses = [...(rules[category] as any)[fieldName], defaultValue];
    updateNestedField(category, fieldName, newBonuses);
  };

  const removeRateBonus = (category: 'batting' | 'bowling', index: number) => {
    if (!isLeagueManager) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const newBonuses = (rules[category] as any)[fieldName].filter((_: any, i: number) => i !== index);
    updateNestedField(category, fieldName, newBonuses);
  };

  const handleSave = async () => {
    if (!isLeagueManager) return;

    // Helper to sanitize any empty strings to 0 before saving
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj === '' ? 0 : obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = sanitize(obj[key]);
      }
      return newObj;
    };

    const sanitizedRules = sanitize(rules);

    setSaving(true);
    const result = await updateScoringRules(sanitizedRules);
    setSaving(false);

    if (result.success) {
      // Invalidate cached player match stats so dialogs show recomputed scores
      queryClient.invalidateQueries({ queryKey: ['player-match-stats'] });
      if (result.error) {
        // Rules saved but recompute had an issue
        toast.warning(result.error);
      } else {
        toast.success('Scoring rules updated and points recomputed');
      }
      setHasChanges(false);
    } else {
      toast.error(result.error || 'Failed to update scoring rules');
    }
  };

  if (gameLoading) {
    return (
      <AppLayout title="Scoring Rules" subtitle="League-level points configuration">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse">Fetching league settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Scoring Rules"
      subtitle="League-level points configuration"
      headerActions={
        hasChanges && isLeagueManager && (
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="hidden md:flex"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Saving & Recomputing...' : 'Save Rules'}
          </Button>
        )
      }
    >
      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        {!isLeagueManager && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3 text-amber-500">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">You are viewing the scoring rules in read-only mode. Only the League Manager can make changes.</p>
          </div>
        )}

        <Tabs defaultValue="common" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8">
            <TabsTrigger value="common" className="gap-2">
              <Settings className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="batting" className="gap-2">
              <Zap className="w-4 h-4" />
              Batting
            </TabsTrigger>
            <TabsTrigger value="bowling" className="gap-2">
              <Target className="w-4 h-4" />
              Bowling
            </TabsTrigger>
            <TabsTrigger value="fielding" className="gap-2">
              <Shield className="w-4 h-4" />
              Fielding
            </TabsTrigger>
          </TabsList>

          {/* COMMON RULES */}
          <TabsContent value="common" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Match Points</CardTitle>
                    <CardDescription>Points for team selection and match outcomes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumericField
                  label="Starting XI Presence"
                  value={rules.common?.starting11}
                  onChange={(val: any) => updateNestedField('common', 'starting11', val)}
                  description="Awarded to every player in the starting XI"
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Match Winning Team"
                  value={rules.common?.matchWinningTeam}
                  onChange={(val: any) => updateNestedField('common', 'matchWinningTeam', val)}
                  description="Awarded to every player in the winning team"
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Man of the Match"
                  value={rules.common?.manOfTheMatch}
                  onChange={(val: any) => updateNestedField('common', 'manOfTheMatch', val)}
                  description="Bonus for being the MoTM"
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Impact Player Bonus"
                  value={rules.common?.impactPlayer}
                  onChange={(val: any) => updateNestedField('common', 'impactPlayer', val)}
                  description="Awarded for appearing as an impact player"
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* BATTING RULES */}
          <TabsContent value="batting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Batting</CardTitle>
                <CardDescription>Runs and boundary bonuses</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NumericField
                  label="Run Scored"
                  value={rules.batting?.runs}
                  onChange={(val: any) => updateNestedField('batting', 'runs', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Four Bonus"
                  value={rules.batting?.four}
                  onChange={(val: any) => updateNestedField('batting', 'four', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Six Bonus"
                  value={rules.batting?.six}
                  onChange={(val: any) => updateNestedField('batting', 'six', val)}
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Batting Milestones</CardTitle>
                  <CardDescription>Bonus points for reaching specific run totals</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => addMilestone('batting')}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {rules.batting?.milestones?.map((ms, idx) => (
                  <div key={idx} className="flex gap-4 items-end">
                    <NumericField
                      label="Runs"
                      value={ms.runs}
                      onChange={(val: any) => updateMilestone('batting', idx, 'runs', val)}
                      className="flex-1"
                      disabled={!isLeagueManager}
                    />
                    <NumericField
                      label="Points"
                      value={ms.points}
                      onChange={(val: any) => updateMilestone('batting', idx, 'points', val)}
                      className="flex-1"
                      disabled={!isLeagueManager}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-10 w-10"
                      onClick={() => removeMilestone('batting', idx)}
                      disabled={!isLeagueManager}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Penalties & Bonuses</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumericField
                  label="Duck Penalty"
                  value={rules.batting?.duckDismissal}
                  onChange={(val: any) => updateNestedField('batting', 'duckDismissal', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Low Score Penalty (≤5 runs)"
                  value={rules.batting?.lowScoreDismissal}
                  onChange={(val: any) => updateNestedField('batting', 'lowScoreDismissal', val)}
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Strike Rate Bonuses</CardTitle>
                  <CardDescription>Points awarded based on batting strike rate (min balls/runs apply)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => addRateBonus('batting')}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {rules.batting?.strikeRateBonuses?.map((sr, idx) => (
                  <div key={idx} className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <NumericField
                        label="Min SR"
                        value={sr.minSR}
                        onChange={(val: any) => updateRateBonus('batting', idx, 'minSR', val)}
                        disabled={!isLeagueManager}
                      />
                      <NumericField
                        label="Max SR"
                        value={sr.maxSR}
                        onChange={(val: any) => updateRateBonus('batting', idx, 'maxSR', val)}
                        disabled={!isLeagueManager}
                      />
                      <NumericField
                        label="Points"
                        value={sr.points}
                        onChange={(val: any) => updateRateBonus('batting', idx, 'points', val)}
                        className="font-bold"
                        disabled={!isLeagueManager}
                      />
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive w-full"
                          onClick={() => removeRateBonus('batting', idx)}
                          disabled={!isLeagueManager}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Remove Band
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                      <NumericField
                        label="MIN BALLS FACED"
                        value={sr.minBalls}
                        onChange={(val: any) => updateRateBonus('batting', idx, 'minBalls', val)}
                        className="text-[10px]"
                        disabled={!isLeagueManager}
                      />
                      <NumericField
                        label="MIN RUNS SCORED"
                        value={sr.minRuns}
                        onChange={(val: any) => updateRateBonus('batting', idx, 'minRuns', val)}
                        className="text-[10px]"
                        disabled={!isLeagueManager}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOWLING RULES */}
          <TabsContent value="bowling" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Bowling</CardTitle>
                <CardDescription>Wickets and accuracy points</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <NumericField
                  label="Points per Wicket"
                  value={rules.bowling?.wickets}
                  onChange={(val: any) => updateNestedField('bowling', 'wickets', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Dot Ball Points"
                  value={rules.bowling?.dotBall}
                  onChange={(val: any) => updateNestedField('bowling', 'dotBall', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="LBW / Bowled Bonus"
                  value={rules.bowling?.lbwOrBowledBonus}
                  onChange={(val: any) => updateNestedField('bowling', 'lbwOrBowledBonus', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Maiden Over Bonus"
                  value={rules.bowling?.maidenOver}
                  onChange={(val: any) => updateNestedField('bowling', 'maidenOver', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Wide Penalty"
                  value={rules.bowling?.widePenalty}
                  onChange={(val: any) => updateNestedField('bowling', 'widePenalty', val)}
                  className="text-destructive"
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="No Ball Penalty"
                  value={rules.bowling?.noBallPenalty}
                  onChange={(val: any) => updateNestedField('bowling', 'noBallPenalty', val)}
                  className="text-destructive"
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Bowling Milestones</CardTitle>
                  <CardDescription>Bonus points for multi-wicket innings</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => addMilestone('bowling')}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {rules.bowling?.milestones?.map((ms, idx) => (
                  <div key={idx} className="flex gap-4 items-end">
                    <NumericField
                      label="Wickets"
                      value={ms.wickets}
                      onChange={(val: any) => updateMilestone('bowling', idx, 'wickets', val)}
                      className="flex-1"
                      disabled={!isLeagueManager}
                    />
                    <NumericField
                      label="Points"
                      value={ms.points}
                      onChange={(val: any) => updateMilestone('bowling', idx, 'points', val)}
                      className="flex-1"
                      disabled={!isLeagueManager}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-10 w-10"
                      onClick={() => removeMilestone('bowling', idx)}
                      disabled={!isLeagueManager}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Economy Rate Bonuses</CardTitle>
                  <CardDescription>Points awarded based on economy rate (min overs apply)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => addRateBonus('bowling')}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {rules.bowling?.economyRateBonuses?.map((er, idx) => (
                  <div key={idx} className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <NumericField
                        label="Min ER"
                        value={er.minER}
                        onChange={(val: any) => updateRateBonus('bowling', idx, 'minER', val)}
                        disabled={!isLeagueManager}
                      />
                      <NumericField
                        label="Max ER"
                        value={er.maxER}
                        onChange={(val: any) => updateRateBonus('bowling', idx, 'maxER', val)}
                        disabled={!isLeagueManager}
                      />
                      <NumericField
                        label="Points"
                        value={er.points}
                        onChange={(val: any) => updateRateBonus('bowling', idx, 'points', val)}
                        className="font-bold"
                        disabled={!isLeagueManager}
                      />
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive w-full"
                          onClick={() => removeRateBonus('bowling', idx)}
                          disabled={!isLeagueManager}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Remove Band
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 pt-2 border-t border-border/50">
                      <NumericField
                        label="MIN OVERS BOWLED"
                        value={er.minOvers}
                        onChange={(val: any) => updateRateBonus('bowling', idx, 'minOvers', val)}
                        className="text-[10px]"
                        description="Minimum 2 overs recommended"
                        disabled={!isLeagueManager}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FIELDING RULES */}
          <TabsContent value="fielding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Regular Fielding</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NumericField
                  label="Catch Points"
                  value={rules.fielding?.catch}
                  onChange={(val: any) => updateNestedField('fielding', 'catch', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Stumping Points"
                  value={rules.fielding?.stumping}
                  onChange={(val: any) => updateNestedField('fielding', 'stumping', val)}
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Run Out Points"
                  value={rules.fielding?.runOut}
                  onChange={(val: any) => updateNestedField('fielding', 'runOut', val)}
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fielding Bonuses</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumericField
                  label="Multi-Catch Threshold"
                  value={rules.fielding?.multiCatchBonus?.count}
                  onChange={(val: any) => updateNestedField('fielding', 'multiCatchBonus', { ...rules.fielding?.multiCatchBonus, count: val })}
                  description="Number of catches for bonus"
                  disabled={!isLeagueManager}
                />
                <NumericField
                  label="Bonus Points"
                  value={rules.fielding?.multiCatchBonus?.points}
                  onChange={(val: any) => updateNestedField('fielding', 'multiCatchBonus', { ...rules.fielding?.multiCatchBonus, points: val })}
                  description="Additional points for reaching threshold"
                  disabled={!isLeagueManager}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* MOBILE SAVE BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border md:hidden">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full h-12 text-base font-bold shadow-[0_-4px_12px_rgba(0,0,0,0.1)]"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            {saving ? 'Saving & Recomputing...' : 'Save All Changes'}
          </Button>
        </div>

        {/* DESKTOP STATUS ALERT */}
        {hasChanges && (
          <div className="hidden md:flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary-foreground/80">You have unsaved changes in your scoring rules.</span>
          </div>
        )}
      </div>
    </AppLayout >
  );
};

export default ScoringRules;
