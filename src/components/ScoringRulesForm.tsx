import {
  Target,
  Zap,
  Shield,
  Settings,
  Trophy,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScoringRules, BattingRules, BowlingRules } from '@/lib/scoring-types';
import { cn } from '@/lib/utils';

type NumericValue = string | number | '';

interface NumericFieldProps {
  label?: string;
  value: NumericValue;
  onChange: (val: NumericValue) => void;
  description?: string;
  className?: string;
  disabled?: boolean;
}

const NumericField = ({ label, value, onChange, description, className, disabled }: NumericFieldProps) => (
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

interface ScoringRulesFormProps {
  rules: ScoringRules;
  onChange: (rules: ScoringRules) => void;
  disabled?: boolean;
}

export const ScoringRulesForm = ({ rules, onChange, disabled = false }: ScoringRulesFormProps) => {
  const updateNestedField = (category: keyof ScoringRules, field: string, value: unknown) => {
    if (disabled) return;
    onChange({
      ...rules,
      [category]: { ...rules[category], [field]: value }
    });
  };

  const updateMilestone = (category: 'batting' | 'bowling', index: number, field: string, value: NumericValue) => {
    if (disabled) return;
    const newMilestones = [...rules[category].milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    updateNestedField(category, 'milestones', newMilestones);
  };

  const addMilestone = (category: 'batting' | 'bowling') => {
    if (disabled) return;
    const newMilestones = [...rules[category].milestones, { [category === 'batting' ? 'runs' : 'wickets']: 0, points: 0 }];
    updateNestedField(category, 'milestones', newMilestones);
  };

  const removeMilestone = (category: 'batting' | 'bowling', index: number) => {
    if (disabled) return;
    const newMilestones = rules[category].milestones.filter((_, i) => i !== index);
    updateNestedField(category, 'milestones', newMilestones);
  };

  const updateRateBonus = (category: 'batting' | 'bowling', index: number, field: string, value: NumericValue) => {
    if (disabled) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const categoryRules = rules[category];
    const bonusArray = category === 'batting'
      ? (categoryRules as BattingRules).strikeRateBonuses
      : (categoryRules as BowlingRules).economyRateBonuses;
    const newBonuses = [...bonusArray];
    newBonuses[index] = { ...newBonuses[index], [field]: value };
    updateNestedField(category, fieldName, newBonuses);
  };

  const addRateBonus = (category: 'batting' | 'bowling') => {
    if (disabled) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const defaultValue = category === 'batting'
      ? { minSR: 0, maxSR: 0, points: 0, minBalls: 10 }
      : { minER: 0, maxER: 0, points: 0, minOvers: 2 };
    const categoryRules = rules[category];
    const bonusArray = category === 'batting'
      ? (categoryRules as BattingRules).strikeRateBonuses
      : (categoryRules as BowlingRules).economyRateBonuses;
    const newBonuses = [...bonusArray, defaultValue];
    updateNestedField(category, fieldName, newBonuses);
  };

  const removeRateBonus = (category: 'batting' | 'bowling', index: number) => {
    if (disabled) return;
    const fieldName = category === 'batting' ? 'strikeRateBonuses' : 'economyRateBonuses';
    const categoryRules = rules[category];
    const bonusArray = category === 'batting'
      ? (categoryRules as BattingRules).strikeRateBonuses
      : (categoryRules as BowlingRules).economyRateBonuses;
    const newBonuses = bonusArray.filter((_, i) => i !== index);
    updateNestedField(category, fieldName, newBonuses);
  };

  return (
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
              onChange={(val: NumericValue) => updateNestedField('common', 'starting11', val)}
              description="Awarded to every player in the starting XI"
              disabled={disabled}
            />
            <NumericField
              label="Match Winning Team"
              value={rules.common?.matchWinningTeam}
              onChange={(val: NumericValue) => updateNestedField('common', 'matchWinningTeam', val)}
              description="Awarded to every player in the winning team"
              disabled={disabled}
            />
            <NumericField
              label="Man of the Match"
              value={rules.common?.manOfTheMatch}
              onChange={(val: NumericValue) => updateNestedField('common', 'manOfTheMatch', val)}
              description="Bonus for being the MoTM"
              disabled={disabled}
            />
            <NumericField
              label="Impact Player Bonus"
              value={rules.common?.impactPlayer}
              onChange={(val: NumericValue) => updateNestedField('common', 'impactPlayer', val)}
              description="Awarded for appearing as an impact player"
              disabled={disabled}
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
              onChange={(val: NumericValue) => updateNestedField('batting', 'runs', val)}
              disabled={disabled}
            />
            <NumericField
              label="Four Bonus"
              value={rules.batting?.four}
              onChange={(val: NumericValue) => updateNestedField('batting', 'four', val)}
              disabled={disabled}
            />
            <NumericField
              label="Six Bonus"
              value={rules.batting?.six}
              onChange={(val: NumericValue) => updateNestedField('batting', 'six', val)}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Batting Milestones</CardTitle>
              <CardDescription>Bonus points for reaching specific run totals</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => addMilestone('batting')} disabled={disabled}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.batting?.milestones?.map((ms, idx) => (
              <div key={idx} className="flex gap-4 items-end">
                <NumericField
                  label="Runs"
                  value={ms.runs}
                  onChange={(val: NumericValue) => updateMilestone('batting', idx, 'runs', val)}
                  className="flex-1"
                  disabled={disabled}
                />
                <NumericField
                  label="Points"
                  value={ms.points}
                  onChange={(val: NumericValue) => updateMilestone('batting', idx, 'points', val)}
                  className="flex-1"
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-10 w-10"
                  onClick={() => removeMilestone('batting', idx)}
                  disabled={disabled}
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
              onChange={(val: NumericValue) => updateNestedField('batting', 'duckDismissal', val)}
              disabled={disabled}
            />
            <NumericField
              label="Low Score Penalty (≤5 runs)"
              value={rules.batting?.lowScoreDismissal}
              onChange={(val: NumericValue) => updateNestedField('batting', 'lowScoreDismissal', val)}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Strike Rate Bonuses</CardTitle>
              <CardDescription>Points awarded based on batting strike rate (min balls/runs apply)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => addRateBonus('batting')} disabled={disabled}>
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
                    onChange={(val: NumericValue) => updateRateBonus('batting', idx, 'minSR', val)}
                    disabled={disabled}
                  />
                  <NumericField
                    label="Max SR"
                    value={sr.maxSR}
                    onChange={(val: NumericValue) => updateRateBonus('batting', idx, 'maxSR', val)}
                    disabled={disabled}
                  />
                  <NumericField
                    label="Points"
                    value={sr.points}
                    onChange={(val: NumericValue) => updateRateBonus('batting', idx, 'points', val)}
                    className="font-bold"
                    disabled={disabled}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive w-full"
                      onClick={() => removeRateBonus('batting', idx)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove Band
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                  <NumericField
                    label="MIN BALLS FACED"
                    value={sr.minBalls}
                    onChange={(val: NumericValue) => updateRateBonus('batting', idx, 'minBalls', val)}
                    className="text-[10px]"
                    disabled={disabled}
                  />
                  <NumericField
                    label="MIN RUNS SCORED"
                    value={sr.minRuns}
                    onChange={(val: NumericValue) => updateRateBonus('batting', idx, 'minRuns', val)}
                    className="text-[10px]"
                    disabled={disabled}
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
              onChange={(val: NumericValue) => updateNestedField('bowling', 'wickets', val)}
              disabled={disabled}
            />
            <NumericField
              label="Dot Ball Points"
              value={rules.bowling?.dotBall}
              onChange={(val: NumericValue) => updateNestedField('bowling', 'dotBall', val)}
              disabled={disabled}
            />
            <NumericField
              label="LBW / Bowled Bonus"
              value={rules.bowling?.lbwOrBowledBonus}
              onChange={(val: NumericValue) => updateNestedField('bowling', 'lbwOrBowledBonus', val)}
              disabled={disabled}
            />
            <NumericField
              label="Maiden Over Bonus"
              value={rules.bowling?.maidenOver}
              onChange={(val: NumericValue) => updateNestedField('bowling', 'maidenOver', val)}
              disabled={disabled}
            />
            <NumericField
              label="Wide Penalty"
              value={rules.bowling?.widePenalty}
              onChange={(val: NumericValue) => updateNestedField('bowling', 'widePenalty', val)}
              className="text-destructive"
              disabled={disabled}
            />
            <NumericField
              label="No Ball Penalty"
              value={rules.bowling?.noBallPenalty}
              onChange={(val: NumericValue) => updateNestedField('bowling', 'noBallPenalty', val)}
              className="text-destructive"
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Bowling Milestones</CardTitle>
              <CardDescription>Bonus points for multi-wicket innings</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => addMilestone('bowling')} disabled={disabled}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.bowling?.milestones?.map((ms, idx) => (
              <div key={idx} className="flex gap-4 items-end">
                <NumericField
                  label="Wickets"
                  value={ms.wickets}
                  onChange={(val: NumericValue) => updateMilestone('bowling', idx, 'wickets', val)}
                  className="flex-1"
                  disabled={disabled}
                />
                <NumericField
                  label="Points"
                  value={ms.points}
                  onChange={(val: NumericValue) => updateMilestone('bowling', idx, 'points', val)}
                  className="flex-1"
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive h-10 w-10"
                  onClick={() => removeMilestone('bowling', idx)}
                  disabled={disabled}
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
            <Button variant="outline" size="sm" onClick={() => addRateBonus('bowling')} disabled={disabled}>
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
                    onChange={(val: NumericValue) => updateRateBonus('bowling', idx, 'minER', val)}
                    disabled={disabled}
                  />
                  <NumericField
                    label="Max ER"
                    value={er.maxER}
                    onChange={(val: NumericValue) => updateRateBonus('bowling', idx, 'maxER', val)}
                    disabled={disabled}
                  />
                  <NumericField
                    label="Points"
                    value={er.points}
                    onChange={(val: NumericValue) => updateRateBonus('bowling', idx, 'points', val)}
                    className="font-bold"
                    disabled={disabled}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive w-full"
                      onClick={() => removeRateBonus('bowling', idx)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove Band
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 pt-2 border-t border-border/50">
                  <NumericField
                    label="MIN OVERS BOWLED"
                    value={er.minOvers}
                    onChange={(val: NumericValue) => updateRateBonus('bowling', idx, 'minOvers', val)}
                    className="text-[10px]"
                    description="Minimum 2 overs recommended"
                    disabled={disabled}
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
              onChange={(val: NumericValue) => updateNestedField('fielding', 'catch', val)}
              disabled={disabled}
            />
            <NumericField
              label="Stumping Points"
              value={rules.fielding?.stumping}
              onChange={(val: NumericValue) => updateNestedField('fielding', 'stumping', val)}
              disabled={disabled}
            />
            <NumericField
              label="Run Out Points"
              value={rules.fielding?.runOut}
              onChange={(val: NumericValue) => updateNestedField('fielding', 'runOut', val)}
              disabled={disabled}
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
              onChange={(val: NumericValue) => updateNestedField('fielding', 'multiCatchBonus', { ...rules.fielding?.multiCatchBonus, count: val })}
              description="Number of catches for bonus"
              disabled={disabled}
            />
            <NumericField
              label="Bonus Points"
              value={rules.fielding?.multiCatchBonus?.points}
              onChange={(val: NumericValue) => updateNestedField('fielding', 'multiCatchBonus', { ...rules.fielding?.multiCatchBonus, points: val })}
              description="Additional points for reaching threshold"
              disabled={disabled}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
