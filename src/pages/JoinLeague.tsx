import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserPlus, Users, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const JoinLeague = () => {
    const { leagueId } = useParams<{ leagueId: string }>();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const [teamName, setTeamName] = useState('');
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [isAlreadyMember, setIsAlreadyMember] = useState(false);
    const [isFull, setIsFull] = useState(false);

    useEffect(() => {
        const checkLeagueStatus = async () => {

            if (!leagueId || !user) {
                setLoading(false);
                return;
            }

            try {
                // Fetch league details
                const { data: league, error: leagueError } = await (supabase
                    .from('leagues' as any)
                    .select('name')
                    .eq('id', leagueId)
                    .single() as any);


                if (leagueError) {
                    console.error('Error fetching league:', leagueError);
                    toast.error('League not found');
                    navigate('/leagues');
                    return;
                }

                setLeagueName(league.name);

                // Check if user is already a manager in this league
                const { data: existingManager } = await (supabase
                    .from('managers' as any)
                    .select('id')
                    .eq('league_id', leagueId)
                    .eq('user_id', user.id)
                    .maybeSingle() as any);


                if (existingManager) {
                    setIsAlreadyMember(true);
                    navigate(`/${leagueId}`);
                    return;
                }

                // Check if there are available slots
                const { data: managers, error: managersError } = await (supabase
                    .from('managers' as any)
                    .select('id, user_id')
                    .eq('league_id', leagueId) as any);


                if (managersError) {
                    console.error('Error fetching managers:', managersError);
                    toast.error('Failed to check league capacity');
                    return;
                }

                const availableSlots = managers?.filter((m: any) => m.user_id === null) || [];

                setIsFull(availableSlots.length === 0);

            } catch (error) {
                console.error('Error checking league status:', error);
                toast.error('An error occurred');
            } finally {
                setLoading(false);
            }
        };

        checkLeagueStatus();
    }, [leagueId, user, navigate]);

    const handleJoinLeague = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!teamName.trim()) {
            toast.error('Please enter a team name');
            return;
        }

        if (!user || !userProfile?.username || !leagueId) {
            toast.error('You must be logged in with a username to join a league');
            return;
        }

        setJoining(true);
        try {
            // Find the first available manager slot
            const { data: availableManagers, error: fetchError } = await (supabase
                .from('managers' as any)
                .select('id, name')
                .eq('league_id', leagueId)
                .is('user_id', null)
                .order('created_at', { ascending: true })
                .limit(1) as any);

            if (fetchError) throw fetchError;

            if (!availableManagers || availableManagers.length === 0) {
                toast.error('No available slots in this league');
                setIsFull(true);
                return;
            }

            const managerToUpdate = availableManagers[0];

            // Update the manager record with user's information
            const { error: updateError } = await (supabase
                .from('managers' as any)
                .update({
                    user_id: user.id,
                    name: userProfile.username,
                    team_name: teamName.trim()
                })
                .eq('id', managerToUpdate.id) as any);

            if (updateError) throw updateError;

            toast.success(`Successfully joined ${leagueName}!`);

            // Navigate to the league dashboard
            navigate(`/${leagueId}`);

        } catch (error: any) {
            console.error('Error joining league:', error);
            toast.error(`Failed to join league: ${error.message}`);
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (isAlreadyMember) {
        return null; // Will redirect via useEffect
    }

    if (isFull) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
                <div className="max-w-md w-full">
                    <Card className="border-2 border-destructive/20 shadow-xl">
                        <CardHeader className="bg-destructive/5 border-b border-destructive/10 text-center">
                            <div className="w-16 h-16 bg-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-destructive/30">
                                <AlertCircle className="w-8 h-8 text-destructive" />
                            </div>
                            <CardTitle className="text-2xl">League is Full</CardTitle>
                            <CardDescription className="text-base">
                                {leagueName} has reached its maximum capacity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 text-center">
                            <p className="text-muted-foreground">
                                All manager slots in this league have been filled. Please check back later or ask the League Manager if they plan to expand.
                            </p>
                        </CardContent>
                        <CardFooter className="bg-muted/50 border-t p-6">
                            <Button
                                onClick={() => navigate('/leagues')}
                                className="w-full h-12 text-lg font-bold"
                                variant="default"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Back to Leagues
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <div className="max-w-md w-full">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/leagues')}
                    className="mb-8 hover:bg-primary/10"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Leagues
                </Button>

                <div className="space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-lg shadow-primary/10">
                            <UserPlus className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Join League</h1>
                        <p className="text-muted-foreground text-lg">{leagueName}</p>
                    </div>

                    <Card className="border-2 border-primary/10 shadow-xl overflow-hidden glass-morphism">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Users className="w-6 h-6 text-primary" />
                                Claim Your Spot
                            </CardTitle>
                            <CardDescription>
                                Logged in as @{userProfile?.username}. Choose your team name for this league.
                            </CardDescription>
                        </CardHeader>

                        <form onSubmit={handleJoinLeague}>
                            <CardContent className="pt-8 space-y-6">
                                <div className="space-y-3">
                                    <Label htmlFor="teamName" className="text-base font-semibold">
                                        Your Team Name
                                    </Label>
                                    <Input
                                        id="teamName"
                                        placeholder="E.g. Thunder Strikers"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        className="h-12 text-lg bg-background/50 border-primary/20 focus:border-primary"
                                        disabled={joining}
                                        autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This will be your team name for the duration of the league.
                                    </p>
                                </div>
                            </CardContent>

                            <CardFooter className="bg-primary/5 border-t border-primary/10 p-6">
                                <Button
                                    type="submit"
                                    className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    disabled={joining || !teamName.trim()}
                                >
                                    {joining ? (
                                        'Joining League...'
                                    ) : (
                                        <>
                                            <UserPlus className="w-5 h-5 mr-2" />
                                            Join League
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default JoinLeague;
