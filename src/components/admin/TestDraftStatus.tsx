import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/useGameStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { TestTubeDiagonal } from 'lucide-react';

type DraftStatus = 'pre_draft' | 'active' | 'completed';

export const TestDraftStatus = () => {
    const currentLeagueId = useGameStore(state => state.currentLeagueId);
    const draftState = useGameStore(state => state.draftState);
    const [updatingUrl, setUpdatingUrl] = useState<DraftStatus | null>(null);

    const handleUpdateStatus = async (status: DraftStatus) => {
        if (!currentLeagueId) return;
        setUpdatingUrl(status);

        try {
            const { error } = await supabase
                .from('draft_state')
                .update({ status })
                .eq('league_id', currentLeagueId);

            if (error) throw error;
            toast.success(`Draft status changed to ${status}`);
        } catch (error: Error | unknown) {
            console.error('Failed to update draft status:', error);
            toast.error('Failed to update draft status: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setUpdatingUrl(null);
        }
    };

    return (
        <Card className="border-border/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TestTubeDiagonal className="w-5 h-5 text-fuchsia-500" />
                    Test Draft Status
                </CardTitle>
                <CardDescription>
                    Manually override the draft status to test UI behaviors in different states.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant={draftState?.status === 'pre_draft' ? 'default' : 'outline'}
                        onClick={() => handleUpdateStatus('pre_draft')}
                        disabled={updatingUrl === 'pre_draft' || !currentLeagueId}
                        className="flex-1"
                    >
                        Pre draft
                    </Button>
                    <Button
                        variant={draftState?.status === 'active' || draftState?.status === 'paused' ? 'default' : 'outline'}
                        onClick={() => handleUpdateStatus('active')}
                        disabled={updatingUrl === 'active' || !currentLeagueId}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                        Draft ongoing
                    </Button>
                    <Button
                        variant={draftState?.status === 'completed' ? 'default' : 'outline'}
                        onClick={() => handleUpdateStatus('completed')}
                        disabled={updatingUrl === 'completed' || !currentLeagueId}
                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                        Post draft
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
