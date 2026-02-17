import { useState, useEffect, useMemo } from 'react';
import { Calendar, Save } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const CurrentWeekSetting = () => {
    const currentWeek = useGameStore(state => state.currentWeek);
    const schedule = useGameStore(state => state.schedule);
    const updateCurrentWeek = useGameStore(state => state.updateCurrentWeek);

    const [selectedWeek, setSelectedWeek] = useState(currentWeek);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setSelectedWeek(currentWeek);
    }, [currentWeek]);

    const availableWeeks = useMemo(() => {
        const weeks = [...new Set(schedule.map(m => m.week))].sort((a, b) => a - b);
        const matchWeeks = weeks.length > 0 ? weeks : [1, 2, 3, 4, 5, 6, 7];
        // Include Week 0 (Pre-Season) as an option
        return [0, ...matchWeeks];
    }, [schedule]);

    const hasChanges = selectedWeek !== currentWeek;

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateCurrentWeek(selectedWeek);
            if (!result.success && result.error) {
                console.error('Failed to update current week:', result.error);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-foreground">Current Week</h2>
                </div>
                {hasChanges && (
                    <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
                )}
            </div>

            <p className="text-sm text-muted-foreground mb-3">
                Set the active match week. Roster changes by managers will apply from the <strong>next week</strong> onward.
                If this is the last week, teams will be locked.
            </p>

            <div className="flex items-center gap-3">
                <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Week" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableWeeks.map(w => (
                            <SelectItem key={w} value={String(w)}>{w === 0 ? 'Week 0 (Pre-Season)' : `Week ${w}`}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    size="sm"
                >
                    {saving ? 'Saving...' : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                        </>
                    )}
                </Button>
            </div>
        </section>
    );
};
