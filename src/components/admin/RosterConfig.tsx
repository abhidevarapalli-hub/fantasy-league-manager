import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeagueConfig, validateLeagueMinimums } from '@/lib/roster-validation';
import { AlertCircle } from 'lucide-react';

interface ConfigField {
  key: keyof LeagueConfig;
  label: string;
  description: string;
  min: number;
  max: number;
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: 'activeSize', label: 'Active Roster Size', description: 'Number of players in starting lineup', min: 1, max: 15 },
  { key: 'benchSize', label: 'Bench Size', description: 'Number of reserve players', min: 0, max: 10 },
  { key: 'minBatsmen', label: 'Min Batsmen', description: 'Minimum batsmen required in active roster', min: 0, max: 11 },
  { key: 'maxBatsmen', label: 'Max Batsmen', description: 'Maximum batsmen allowed in active roster', min: 1, max: 11 },
  { key: 'minBowlers', label: 'Min Bowlers', description: 'Minimum bowlers required in active roster', min: 0, max: 11 },
  { key: 'minWks', label: 'Min Wicket Keepers', description: 'Minimum wicket keepers required', min: 0, max: 5 },
  { key: 'minAllRounders', label: 'Min All-Rounders', description: 'Minimum all-rounders required', min: 0, max: 11 },
  { key: 'maxInternational', label: 'Max International', description: 'Maximum international players allowed', min: 0, max: 11 },
];

export const RosterConfig = () => {
  const config = useGameStore(state => state.config);
  const updateLeagueConfig = useGameStore(state => state.updateLeagueConfig);

  const [editedConfig, setEditedConfig] = useState<LeagueConfig>(config);
  const [saving, setSaving] = useState(false);

  // Sync with store config when it changes
  useEffect(() => {
    setEditedConfig(config);
  }, [config]);

  const hasChanges = JSON.stringify(editedConfig) !== JSON.stringify(config);

  const handleChange = (key: keyof LeagueConfig, value: string) => {
    const numValue = parseInt(value) || 0;
    setEditedConfig(prev => ({ ...prev, [key]: numValue }));
  };

  const validationResult = validateLeagueMinimums(editedConfig);

  const handleSave = async () => {
    if (!validationResult.isValid) return;

    setSaving(true);
    try {
      const result = await updateLeagueConfig(editedConfig);
      if (!result.success && result.error) {
        console.error('Failed to save config:', result.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEditedConfig(config);
  };

  return (
    <section className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Roster Configuration</h2>
        </div>
        {hasChanges && (
          <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
        )}
      </div>

      {!validationResult.isValid && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-500">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{validationResult.message}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONFIG_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label className="text-sm font-medium text-foreground">
                {field.label}
              </Label>
              <Input
                type="number"
                min={field.min}
                max={field.max}
                value={editedConfig[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="bg-muted border-border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-xs text-muted-foreground">{field.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Total Roster Cap:</span>{' '}
            {editedConfig.activeSize + editedConfig.benchSize} players
            ({editedConfig.activeSize} active + {editedConfig.benchSize} bench)
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Minimum Requirements Sum:</span>
            <span className={`font-mono font-bold ${!validationResult.isValid ? 'text-red-500' : 'text-green-500'}`}>
              {editedConfig.minWks + editedConfig.minBatsmen + editedConfig.minBowlers + editedConfig.minAllRounders} / {editedConfig.activeSize}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1"
            disabled={!hasChanges || saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!hasChanges || saving || !validationResult.isValid}
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};
