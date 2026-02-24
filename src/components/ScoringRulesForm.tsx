import {
  Target,
  Zap,
  Shield,
  Settings,
  Trophy,
  Plus,
  Trash2,
  Timer,
  Users,
  Layout,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScoringRules, BattingRules, BowlingRules } from '@/lib/scoring-types';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { validateLeagueMinimums } from '@/lib/roster-validation';

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
  draftTimerSeconds?: number;
  onDraftTimerChange?: (seconds: number) => void;
  // Roster config props
  activeSize?: number;
  onActiveSizeChange?: (val: number) => void;
  benchSize?: number;
  onBenchSizeChange?: (val: number) => void;
  minBatWk?: number;
  onMinBatWkChange?: (val: number) => void;
  minBowlers?: number;
  onMinBowlersChange?: (val: number) => void;
  minAllRounders?: number;
  onMinAllRoundersChange?: (val: number) => void;
  requireWk?: boolean;
  onRequireWkChange?: (val: boolean) => void;
  maxInternational?: number;
  onMaxInternationalChange?: (val: number) => void;
  disabled?: boolean;
  showTabs?: boolean;
}

export const ScoringRulesForm = ({
  rules,
  onChange,
  draftTimerSeconds = 60,
  onDraftTimerChange,
  activeSize = 11,
  onActiveSizeChange,
  benchSize = 3,
  onBenchSizeChange,
  minBatWk = 4,
  onMinBatWkChange,
  minBowlers = 3,
  onMinBowlersChange,
  minAllRounders = 2,
  onMinAllRoundersChange,
  requireWk = true,
  onRequireWkChange,
  maxInternational = 4,
  onMaxInternationalChange,
  disabled = false,
  showTabs = true
}: ScoringRulesFormProps) => {
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
    <Tabs defaultValue={showTabs ? "general" : "scoring"} className="w-full">
      {showTabs && (
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="scoring" className="gap-2">
            <Trophy className="w-4 h-4" />
            Scoring
          </TabsTrigger>
        </TabsList>
      )}

      {/* GENERAL TAB */}
      {showTabs && (
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Draft & Roster</CardTitle>
                  <CardDescription>Configure draft settings and roster requirements</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {onDraftTimerChange && (
                <div className="space-y-3 pb-6 border-b border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                      <Timer className="w-4 h-4 text-primary" />
                    </div>
                    <Label className="text-base font-semibold">Draft Pick Timer</Label>
                  </div>
                  <RadioGroup
                    value={draftTimerSeconds.toString()}
                    onValueChange={(val) => onDraftTimerChange(parseInt(val))}
                    disabled={disabled}
                    className="grid grid-cols-3 sm:grid-cols-5 gap-3"
                  >
                    {[30, 60, 90, 120, 200].map((seconds) => (
                      <div key={seconds}>
                        <RadioGroupItem
                          value={seconds.toString()}
                          id={`timer-form-${seconds}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`timer-form-${seconds}`}
                          className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all h-12"
                        >
                          <span className="text-sm font-bold">{seconds}s</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">Time allowed for each manager to make their pick during the draft.</p>
                </div>
              )}

              {/* ROSTER CONFIGURATION BLOCK */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                      <Layout className="w-4 h-4 text-primary" />
                    </div>
                    <Label className="text-base font-semibold">Roster Configuration</Label>
                  </div>
                  {onActiveSizeChange && (
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "text-sm font-bold px-2 py-0.5 rounded-md",
                        !validateLeagueMinimums({
                          activeSize,
                          benchSize,
                          minBatWk,
                          minBowlers,
                          minAllRounders,
                          requireWk,
                          maxBatWk: 7,
                          maxBowlers: 6,
                          maxAllRounders: 4,
                          maxInternational,
                          managerCount: 8 // dummy for validation
                        }).isValid ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                      )}>
                        Total: {minBatWk + minBowlers + minAllRounders} / {activeSize}
                      </span>
                    </div>
                  )}
                </div>

                {!validateLeagueMinimums({
                  activeSize,
                  benchSize,
                  minBatWk,
                  minBowlers,
                  minAllRounders,
                  requireWk,
                  maxBatWk: 7,
                  maxBowlers: 6,
                  maxAllRounders: 4,
                  maxInternational,
                  managerCount: 8
                }).isValid && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {validateLeagueMinimums({
                          activeSize,
                          benchSize,
                          minBatWk,
                          minBowlers,
                          minAllRounders,
                          requireWk,
                          maxBatWk: 7,
                          maxBowlers: 6,
                          maxAllRounders: 4,
                          maxInternational,
                          managerCount: 8
                        }).message}
                      </AlertDescription>
                    </Alert>
                  )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        Active Size
                      </Label>
                      <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{activeSize}</span>
                    </div>
                    <Slider
                      value={[activeSize]}
                      min={6}
                      max={11}
                      step={1}
                      disabled={disabled || !onActiveSizeChange}
                      onValueChange={([v]) => onActiveSizeChange?.(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">Players in the starting lineup (6-11).</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        Bench Size
                      </Label>
                      <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{benchSize}</span>
                    </div>
                    <Slider
                      value={[benchSize]}
                      min={0}
                      max={5}
                      step={1}
                      disabled={disabled || !onBenchSizeChange}
                      onValueChange={([v]) => onBenchSizeChange?.(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">Reserve players (0-5).</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        Max International
                      </Label>
                      <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{maxInternational}</span>
                    </div>
                    <Slider
                      value={[maxInternational]}
                      min={1}
                      max={11}
                      step={1}
                      disabled={disabled || !onMaxInternationalChange}
                      onValueChange={([v]) => onMaxInternationalChange?.(v)}
                    />
                    <p className="text-[10px] text-muted-foreground">Limit for non-domestic players (1-11).</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium text-muted-foreground">Min BAT/WK</Label>
                      <span className="text-xs font-bold">{minBatWk}</span>
                    </div>
                    <Slider
                      value={[minBatWk]}
                      min={1}
                      max={8}
                      step={1}
                      disabled={disabled || !onMinBatWkChange}
                      onValueChange={([v]) => onMinBatWkChange?.(v)}
                    />
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/50 mt-2">
                      <span className="text-[10px] font-medium">Require WK</span>
                      <Switch
                        checked={requireWk}
                        disabled={disabled || !onRequireWkChange}
                        onCheckedChange={onRequireWkChange}
                        className="scale-75"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium text-muted-foreground">Min All-Rounders</Label>
                      <span className="text-xs font-bold">{minAllRounders}</span>
                    </div>
                    <Slider
                      value={[minAllRounders]}
                      min={0}
                      max={6}
                      step={1}
                      disabled={disabled || !onMinAllRoundersChange}
                      onValueChange={([v]) => onMinAllRoundersChange?.(v)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium text-muted-foreground">Min Bowlers</Label>
                      <span className="text-xs font-bold">{minBowlers}</span>
                    </div>
                    <Slider
                      value={[minBowlers]}
                      min={1}
                      max={8}
                      step={1}
                      disabled={disabled || !onMinBowlersChange}
                      onValueChange={([v]) => onMinBowlersChange?.(v)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* SCORING TAB */}
      <TabsContent value="scoring" className="space-y-8">
        {/* MATCH POINTS (previously common) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Match Points</CardTitle>
                <CardDescription>Points for team selection and match outcomes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
          </CardContent>
        </Card>

        {/* BATTING RULES */}
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
