
import { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  AlertCircle,
  Timer,
  Lock
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScoringRules as ScoringRulesType } from '@/lib/scoring-types';
import { ScoringRulesForm } from '@/components/ScoringRulesForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const LeagueRules = () => {
  const scoringRules = useGameStore((state) => state.scoringRules);
  const updateScoringRules = useGameStore((state) => state.updateScoringRules);
  const gameLoading = useGameStore((state) => state.loading);
  const config = useGameStore((state) => state.config);
  const draftState = useGameStore((state) => state.draftState);
  const updateLeagueConfig = useGameStore((state) => state.updateLeagueConfig);
  const isLeagueManager = useAuthStore((state) => state.isLeagueManager());

  // Check if rules should be locked
  const isDraftLocked = draftState && draftState.status !== 'pre_draft';
  const isReadOnly = !isLeagueManager || isDraftLocked;

  // Local state for form
  const [rules, setRules] = useState<ScoringRulesType>(scoringRules);
  const [draftTimer, setDraftTimer] = useState<number>(config.draftTimerSeconds || 60);
  const [activeSize, setActiveSize] = useState<number>(config.activeSize || 11);
  const [benchSize, setBenchSize] = useState<number>(config.benchSize || 3);
  const [minBatWk, setMinBatWk] = useState<number>(config.minBatWk || 4);
  const [minBowlers, setMinBowlers] = useState<number>(config.minBowlers || 3);
  const [minAllRounders, setMinAllRounders] = useState<number>(config.minAllRounders || 2);
  const [requireWk, setRequireWk] = useState<boolean>(config.requireWk ?? true);
  const [maxInternational, setMaxInternational] = useState<number>(config.maxInternational || 4);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when scoringRules from context changes
  useEffect(() => {
    setRules(scoringRules);
  }, [scoringRules]);

  // Sync config when context changes
  useEffect(() => {
    if (config) {
      setDraftTimer(config.draftTimerSeconds || 60);
      setActiveSize(config.activeSize || 11);
      setBenchSize(config.benchSize || 3);
      setMinBatWk(config.minBatWk || 4);
      setMinBowlers(config.minBowlers || 3);
      setMinAllRounders(config.minAllRounders || 2);
      setRequireWk(config.requireWk ?? true);
      setMaxInternational(config.maxInternational || 4);
    }
  }, [config]);

  // If not league manager or locked, they can only view
  useEffect(() => {
    if (!gameLoading) {
      if (isDraftLocked) {
        console.log('League rules are locked because the draft has started/finished');
      } else if (!isLeagueManager) {
        console.log('User is not a league manager, viewing in read-only mode');
      }
    }
  }, [isLeagueManager, gameLoading, isDraftLocked]);

  const handleRulesChange = (newRules: ScoringRulesType) => {
    if (isReadOnly) return;
    setRules(newRules);
    setHasChanges(true);
  };

  const handleTimerChange = (val: string) => {
    if (isReadOnly) return;
    setDraftTimer(parseInt(val));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (isReadOnly) return;

    setSaving(true);
    const scoringResult = await updateScoringRules(rules);

    // Also update draft timer and roster config if changed
    let configResult = { success: true };
    const configChanged =
      draftTimer !== config.draftTimerSeconds ||
      activeSize !== config.activeSize ||
      benchSize !== config.benchSize ||
      minBatWk !== config.minBatWk ||
      minBowlers !== config.minBowlers ||
      minAllRounders !== config.minAllRounders ||
      requireWk !== config.requireWk ||
      maxInternational !== config.maxInternational;

    if (configChanged) {
      configResult = await updateLeagueConfig({
        draftTimerSeconds: draftTimer,
        activeSize,
        benchSize,
        minBatWk,
        minBowlers,
        minAllRounders,
        requireWk,
        maxInternational
      });
    }

    setSaving(false);

    if (scoringResult.success && configResult.success) {
      if (scoringResult.error) {
        toast.warning(scoringResult.error);
      } else {
        toast.success('League rules updated successfully');
      }
      setHasChanges(false);
    } else {
      toast.error('Failed to update league rules');
    }
  };

  if (gameLoading) {
    return (
      <AppLayout title="League Rules" subtitle="Configure scoring and draft settings">
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
      title="League Rules"
      subtitle="Configure scoring and draft settings"
      headerActions={
        hasChanges && !isReadOnly && (
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
        {isDraftLocked && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3 text-amber-500">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">League rules are locked. Scoring and draft configuration cannot be changed once the draft has started.</p>
          </div>
        )}

        {!isDraftLocked && !isLeagueManager && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3 text-amber-500">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">You are viewing the rules in read-only mode. Only the League Manager can make changes.</p>
          </div>
        )}


        <ScoringRulesForm
          rules={rules}
          onChange={handleRulesChange}
          draftTimerSeconds={draftTimer}
          onDraftTimerChange={(seconds) => {
            setDraftTimer(seconds);
            setHasChanges(true);
          }}
          activeSize={activeSize}
          onActiveSizeChange={(val) => {
            setActiveSize(val);
            setHasChanges(true);
          }}
          benchSize={benchSize}
          onBenchSizeChange={(val) => {
            setBenchSize(val);
            setHasChanges(true);
          }}
          minBatWk={minBatWk}
          onMinBatWkChange={(val) => {
            setMinBatWk(val);
            setHasChanges(true);
          }}
          minBowlers={minBowlers}
          onMinBowlersChange={(val) => {
            setMinBowlers(val);
            setHasChanges(true);
          }}
          minAllRounders={minAllRounders}
          onMinAllRoundersChange={(val) => {
            setMinAllRounders(val);
            setHasChanges(true);
          }}
          requireWk={requireWk}
          onRequireWkChange={(val) => {
            setRequireWk(val);
            setHasChanges(true);
          }}
          maxInternational={maxInternational}
          onMaxInternationalChange={(val) => {
            setMaxInternational(val);
            setHasChanges(true);
          }}
          disabled={isReadOnly}
        />

        {/* MOBILE SAVE BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border md:hidden">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges || isReadOnly}
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

export default LeagueRules;
