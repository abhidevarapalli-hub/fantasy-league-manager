import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Users, Shield, Layout, Save, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { toast } from 'sonner';

const CreateLeague = () => {
    const navigate = useNavigate();
    const { user, userProfile, selectManager } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // League Settings
    const [leagueName, setLeagueName] = useState('');
    const [managerCount, setManagerCount] = useState(8);
    const [activeSize, setActiveSize] = useState(11);
    const [benchSize, setBenchSize] = useState(3);

    // Creator Manager Settings
    const [teamName, setTeamName] = useState('');

    const handleCreateLeague = async () => {
        // Use username from profile, fallback to email prefix or ID if somehow missing
        const displayName = userProfile?.username || user?.email?.split('@')[0] || user?.id || 'Unknown';

        if (!user || !leagueName || !teamName) {
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);
        try {
            // 1. Create the league
            const { data: league, error: leagueError } = await (supabase
                .from('leagues' as any)
                .insert({
                    name: leagueName,
                    league_manager_id: user.id,
                    manager_count: managerCount,
                    active_size: activeSize,
                    bench_size: benchSize,
                    min_batsmen: 1,
                    max_batsmen: 6,
                    min_bowlers: 3,
                    min_wks: 1,
                    min_all_rounders: 1,
                    max_international: 4
                })
                .select()
                .single() as any);



            if (leagueError) throw leagueError;

            // 2. Create the creator's manager record
            const { error: managerError } = await supabase
                .from('managers')
                .insert({
                    name: displayName,
                    team_name: teamName,
                    league_id: league.id,
                    user_id: user.id,
                    is_league_manager: true,
                    wins: 0,
                    losses: 0,
                    points: 0,
                    roster: [],
                    bench: []
                });

            if (managerError) throw managerError;


            // 3. Create placeholder teams for the rest
            const placeholders = [];
            for (let i = 1; i < managerCount; i++) {
                placeholders.push({
                    name: `Manager ${i + 1}`,
                    team_name: `Empty Team ${i + 1}`,
                    league_id: league.id,
                    user_id: null,
                    wins: 0,
                    losses: 0,
                    points: 0,
                    roster: [],
                    bench: []
                });
            }

            let allManagers: any[] = [];
            if (placeholders.length > 0) {
                const { data: createdPlaceholders, error: placeholderError } = await supabase
                    .from('managers')
                    .insert(placeholders)
                    .select();

                if (placeholderError) throw placeholderError;

                // Fetch the creator manager we just made to get its real ID
                const { data: creatorManager } = await (supabase
                    .from('managers' as any)
                    .select('*')
                    .eq('league_id', league.id)
                    .eq('user_id', user.id)
                    .single() as any);

                allManagers = [creatorManager, ...createdPlaceholders];
            } else {
                const { data: creatorManager } = await (supabase
                    .from('managers' as any)
                    .select('*')
                    .eq('league_id', league.id)
                    .eq('user_id', user.id)
                    .single() as any);
                allManagers = [creatorManager];
            }

            // 4. Generate Randomized Schedule (7 Weeks)
            const managerIds = allManagers.map(m => m.id);
            const numTeams = managerIds.length;
            const weeks = 7;
            const matchups: any[] = [];

            // Helper to shuffle array
            const shuffle = (array: any[]) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            const shuffledIds = shuffle([...managerIds]);
            if (numTeams % 2 !== 0) shuffledIds.push(null); // Add BYE if odd

            const n = shuffledIds.length;
            const rounds: any[][] = [];

            // Generate all possible rounds for a full round-robin
            for (let r = 0; r < n - 1; r++) {
                const roundMatchups = [];
                for (let i = 0; i < n / 2; i++) {
                    const home = shuffledIds[i];
                    const away = shuffledIds[n - 1 - i];
                    if (home && away) {
                        roundMatchups.push([home, away]);
                    }
                }
                rounds.push(roundMatchups);
                // Rotate clockwise, keeping first element fixed
                shuffledIds.splice(1, 0, shuffledIds.pop()!);
            }

            // Shuffle the rounds themselves to add more randomness
            shuffle(rounds);

            for (let w = 1; w <= weeks; w++) {
                // Pick round (repeat if we run out of rounds for small leagues)
                const roundIndex = (w - 1) % (n - 1);
                const roundMatchups = rounds[roundIndex];

                roundMatchups.forEach(([homeId, awayId]) => {
                    matchups.push({
                        league_id: league.id,
                        week: w,
                        home_manager_id: homeId,
                        away_manager_id: awayId,
                        home_score: 0,
                        away_score: 0,
                        is_finalized: false
                    });
                });
            }

            const { error: scheduleError } = await (supabase
                .from('schedule' as any)
                .insert(matchups) as any);


            if (scheduleError) console.error("Error creating schedule:", scheduleError);

            // 5. Mark in AuthContext that this is the selected manager
            await selectManager(displayName, league.id);


            toast.success("League created successfully!");
            navigate(`/${league.id}`);
        } catch (error: any) {
            console.error(error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <div className="max-w-2xl w-full">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/leagues')}
                    className="mb-8 hover:bg-primary/10"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Selection
                </Button>

                <div className="space-y-8">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-lg shadow-primary/10">
                            <Trophy className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Create New League</h1>
                        <p className="text-muted-foreground text-lg italic">Step {step} of 2: {step === 1 ? 'Configure Rules' : 'Team Identity'}</p>
                    </div>

                    <Card className="border-2 border-primary/10 shadow-xl overflow-hidden glass-morphism">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="text-2xl">{step === 1 ? 'League Configuration' : 'League Manager Setup'}</CardTitle>
                            <CardDescription>
                                {step === 1
                                    ? 'Set the core structure and constraints for your competition.'
                                    : `Logged in as @${userProfile?.username || 'user'}. Choose your team name for this league.`}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-8 space-y-8">
                            {step === 1 ? (
                                <>
                                    <div className="space-y-3">
                                        <Label htmlFor="leagueName" className="text-base font-semibold">League Name</Label>
                                        <Input
                                            id="leagueName"
                                            placeholder="E.g. Champions League 2025"
                                            value={leagueName}
                                            onChange={(e) => setLeagueName(e.target.value)}
                                            className="h-12 text-lg bg-background/50 border-primary/20 focus:border-primary"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-primary" />
                                                    Managers
                                                </Label>
                                                <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{managerCount}</span>
                                            </div>
                                            <Slider
                                                value={[managerCount]}
                                                min={4}
                                                max={12}
                                                step={2}
                                                onValueChange={([v]) => setManagerCount(v)}
                                            />
                                            <p className="text-xs text-muted-foreground">Number of competing teams in the league (Even numbers 4-12).</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Layout className="w-4 h-4 text-primary" />
                                                    Active Size
                                                </Label>
                                                <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{activeSize}</span>
                                            </div>
                                            <Slider
                                                value={[activeSize]}
                                                min={6}
                                                max={11}
                                                step={1}
                                                onValueChange={([v]) => setActiveSize(v)}
                                            />
                                            <p className="text-xs text-muted-foreground">Players in the starting lineup (6-11).</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="font-semibold flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-primary" />
                                                    Bench Size
                                                </Label>
                                                <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">{benchSize}</span>
                                            </div>
                                            <Slider
                                                value={[benchSize]}
                                                min={0}
                                                max={5}
                                                step={1}
                                                onValueChange={([v]) => setBenchSize(v)}
                                            />
                                            <p className="text-xs text-muted-foreground">Reserve players kept out of the lineup (0-5).</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="teamName" className="text-base font-semibold">Your Team Name</Label>
                                        <Input
                                            id="teamName"
                                            placeholder="E.g. Royal Flushers"
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            className="h-12 text-lg bg-background/50 border-primary/20 focus:border-primary"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>


                        <CardFooter className="bg-primary/5 border-t border-primary/10 p-6 flex gap-4">
                            {step === 2 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(1)}
                                    className="flex-1 h-12 text-base"
                                    disabled={loading}
                                >
                                    Back
                                </Button>
                            )}

                            <Button
                                className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                onClick={() => step === 1 ? setStep(2) : handleCreateLeague()}
                                disabled={loading || (step === 1 && !leagueName) || (step === 2 && !teamName)}

                            >
                                {loading ? (
                                    'Creating League...'
                                ) : step === 1 ? (
                                    <>
                                        Next Strategy
                                        <ChevronRight className="w-5 h-5 ml-2" />
                                    </>
                                ) : (
                                    <>
                                        Launch League
                                        <Save className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CreateLeague;
