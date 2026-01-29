import { useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw, Globe, Zap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';
import { SUPPORTED_TOURNAMENTS, getTournamentById } from '@/lib/tournaments';

export const DangerZone = () => {
  const resetLeague = useGameStore(state => state.resetLeague);
  const leagueId = useGameStore(state => state.currentLeagueId);
  const fetchAllData = useGameStore(state => state.fetchAllData);

  const { reseedFromTournament, seeding: isReseeding } = useSeedDatabase();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showReseedConfirm, setShowReseedConfirm] = useState(false);
  const [reseedTournamentId, setReseedTournamentId] = useState<string>('');

  return (
    <section className="bg-card rounded-xl border border-destructive/30 p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="font-semibold text-destructive">Danger Zone</h2>
      </div>

      <div className="space-y-3">
        {/* Reseed Players */}
        {!showReseedConfirm ? (
          <Button
            onClick={() => setShowReseedConfirm(true)}
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reseed Player Database from Tournament
          </Button>
        ) : (
          <div className="space-y-3 p-3 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-sm text-primary">
              Select a tournament to reseed players from. This will clear all existing players and rosters!
            </p>
            <Select value={reseedTournamentId} onValueChange={setReseedTournamentId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select tournament" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOURNAMENTS.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    <div className="flex items-center gap-2">
                      {t.type === 'international' ? (
                        <Globe className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Zap className="w-4 h-4 text-yellow-500" />
                      )}
                      {t.shortName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                onClick={() => { setShowReseedConfirm(false); setReseedTournamentId(''); }}
                variant="outline"
                className="flex-1"
                disabled={isReseeding}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!leagueId) {
                    toast.error('No league selected. Please select a league first.');
                    return;
                  }
                  if (!reseedTournamentId) {
                    toast.error('Please select a tournament to reseed from.');
                    return;
                  }
                  try {
                    const tournament = getTournamentById(Number(reseedTournamentId));
                    toast.info(`Reseeding players from ${tournament?.shortName}...`);
                    const success = await reseedFromTournament(leagueId, Number(reseedTournamentId));
                    if (success) {
                      toast.success(`Players reseeded from ${tournament?.shortName}`);
                      await fetchAllData(leagueId);
                    } else {
                      toast.error('Failed to reseed players. Check console for details.');
                    }
                  } catch (error) {
                    console.error('[Admin] Error reseeding players:', error);
                    toast.error('An error occurred while reseeding. Check console for details.');
                  } finally {
                    setShowReseedConfirm(false);
                    setReseedTournamentId('');
                  }
                }}
                disabled={!reseedTournamentId || isReseeding}
                className="flex-1"
              >
                {isReseeding ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Reseeding...
                  </>
                ) : (
                  'Confirm Reseed'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Reset League */}
        {!showResetConfirm ? (
          <Button
            onClick={() => setShowResetConfirm(true)}
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset League
          </Button>
        ) : (
          <div className="space-y-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
            <p className="text-sm text-destructive">
              ⚠️ This will reset all standings, scores, rosters, and activities. This cannot be undone!
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
                onClick={() => {
                  resetLeague();
                  setShowResetConfirm(false);
                }}
                variant="destructive"
                className="flex-1"
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
