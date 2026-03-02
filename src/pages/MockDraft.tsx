import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { MockDraftBoard } from '@/components/MockDraftBoard';
import { useMockStore } from '@/store/useMockStore';
import { supabase } from '@/integrations/supabase/client';
import { Player } from '@/lib/supabase-types';
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
                const { data, error } = await supabase
                    .from('master_players')
                    .select('*')
                    .order('id');

                const iplTeams = ['CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RR', 'RCB', 'SRH'];

                const mappedPlayers: Player[] = (data || [])
                    .filter(p => p.teams && p.teams.some((t: string) => iplTeams.includes(t)))
                    .map(p => ({
                        id: p.id,
                        name: p.name,
                        team: p.teams && p.teams.length > 0 ? p.teams[0] : 'Unknown', // Primary team
                        role: p.primary_role as Player['role'],
                        points: 0,
                        isInternational: p.is_international,
                        cricbuzz_id: null,
                    }));

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
