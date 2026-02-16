import { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  AlertCircle
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScoringRules as ScoringRulesType, sanitizeScoringRules } from '@/lib/scoring-types';
import { ScoringRulesForm } from '@/components/ScoringRulesForm';

const ScoringRules = () => {
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
      console.log('User is not a league manager, viewing in read-only mode');
    }
  }, [isLeagueManager, gameLoading]);

  const handleRulesChange = (newRules: ScoringRulesType) => {
    setRules(newRules);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!isLeagueManager) return;

    const sanitizedRules = sanitizeScoringRules(rules);

    setSaving(true);
    const result = await updateScoringRules(sanitizedRules);
    setSaving(false);

    if (result.success) {
      if (result.error) {
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

        <ScoringRulesForm rules={rules} onChange={handleRulesChange} disabled={!isLeagueManager} />

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
