import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { MockDraftBoard } from '@/components/MockDraftBoard';
import { useMockStore } from '@/store/useMockStore';
import { supabase } from '@/integrations/supabase/client';
import { Player } from '@/lib/supabase-types';
import { getDefaultTournament } from '@/lib/tournaments';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MockDraft = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const draft = useMockStore(state => id ? state.drafts[id] : undefined);

    const [masterPlayers, setMasterPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id || !draft) {
            toast.error("Draft not found");
            navigate('/');
            return;
        }

        const fetchPlayers = async () => {
            try {
                const { data } = await supabase
                    .from('tournament_players')
                    .select('player_id, team_code, master_players!inner(id, name, primary_role, is_international)')
                    .eq('tournament_id', getDefaultTournament().id);

                const mappedPlayers: Player[] = (data || [])
                    .map(p => {
                        const mp = p.master_players as unknown as { id: string; name: string; primary_role: string; is_international: boolean };
                        return {
                            id: mp.id,
                            name: mp.name,
                            team: p.team_code || 'Unknown',
                            role: mp.primary_role as Player['role'],
                            points: 0,
                            isInternational: mp.is_international,
                            cricbuzz_id: null,
                        };
                    });

                setMasterPlayers(mappedPlayers);
            } catch (err) {
                console.error("Failed to load players", err);
                toast.error("Failed to load player database");
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, [id, draft, navigate]);

    if (!draft) return null;

    if (loading) {
        return (
            <AppLayout title="Mock Draft">
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading player database...</p>
                </div>
            </AppLayout>
        );
    }

    const rounds = draft.config.activeSize + draft.config.benchSize;

    return (
        <AppLayout
            title="Mock Draft"
            subtitle={`${draft.config.managerCount} teams × ${rounds} rounds snake draft`}
        >
            <div className="px-4 py-4 max-w-7xl mx-auto w-full">
                <MockDraftBoard draftId={id!} masterPlayers={masterPlayers} />
            </div>
        </AppLayout>
    );
};

export default MockDraft;
