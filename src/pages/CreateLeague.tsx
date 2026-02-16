import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Users, Shield, Layout, Save, ChevronRight, Globe, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useSeedDatabase } from '@/hooks/useSeedDatabase';
import { SUPPORTED_TOURNAMENTS, type Tournament } from '@/lib/tournaments';
import { validateLeagueMinimums, LeagueConfig } from '@/lib/roster-validation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

import { toast } from 'sonner';
import { DEFAULT_SCORING_RULES, ScoringRules as ScoringRulesType, sanitizeScoringRules } from '@/lib/scoring-types';
import type { Json } from '@/integrations/supabase/types';
import { ScoringRulesForm } from '@/components/ScoringRulesForm';

const STEP_LABELS = ['Configure Rules', 'Scoring Rules', 'Team Identity'] as const;

const CreateLeague = () => {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const userProfile = useAuthStore(state => state.userProfile);
    const selectManager = useAuthStore(state => state.selectManager);
    const { seedFromTournament, seedDatabase } = useSeedDatabase();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // League Settings
    const [leagueName, setLeagueName] = useState('');
    const [managerCount, setManagerCount] = useState(8);
    const [activeSize, setActiveSize] = useState(11);
    const [benchSize, setBenchSize] = useState(3);

    // Position Minimums (Defaults for Size 11)
    const [minWks, setMinWks] = useState(1);
    const [minBatsmen, setMinBatsmen] = useState(1); // Standard default is 1, but we might want 3 for size 11
    const [minBowlers, setMinBowlers] = useState(3);
    const [minAllRounders, setMinAllRounders] = useState(1);

    // Dynamic Defaults based on Active Size
    useEffect(() => {
        // Only set intelligent defaults if the user hasn't heavily customized (optional refinement, but simple overwrite is easier for now)
        switch (activeSize) {
            case 11:
                setMinWks(1); setMinBatsmen(3); setMinBowlers(3); setMinAllRounders(1);
                break;
            case 10:
                setMinWks(1); setMinBatsmen(2); setMinBowlers(3); setMinAllRounders(1);
                break;
            case 9:
                setMinWks(1); setMinBatsmen(2); setMinBowlers(2); setMinAllRounders(1);
                break;
            case 8:
                setMinWks(1); setMinBatsmen(2); setMinBowlers(2); setMinAllRounders(1);
                break;
            case 7:
                setMinWks(1); setMinBatsmen(1); setMinBowlers(2); setMinAllRounders(1);
                break;
            case 6:
                setMinWks(1); setMinBatsmen(1); setMinBowlers(1); setMinAllRounders(1);
                break;
            default:
                // Safe fallbacks for other sizes
                setMinWks(1); setMinBatsmen(1); setMinBowlers(1); setMinAllRounders(1);
        }
    }, [activeSize]);

    // Validation
    const leagueConfigForValidation: LeagueConfig = {
        managerCount, activeSize, benchSize,
        minWks, minBatsmen, minBowlers, minAllRounders,
        maxBatsmen: 10, // Not used in UI yet, but required by type
        maxInternational: 4 // Not user configurable yet
    };
    const validationResult = validateLeagueMinimums(leagueConfigForValidation);


    // Tournament Selection (default to IPL)
    const [selectedTournament, setSelectedTournament] = useState<Tournament>(
        SUPPORTED_TOURNAMENTS.find(t => t.type === 'league') || SUPPORTED_TOURNAMENTS[0]
    );

    // Scoring Rules
    const [scoringRules, setScoringRules] = useState<ScoringRulesType>(DEFAULT_SCORING_RULES);

    // Creator Manager Settings
    const [teamName, setTeamName] = useState('');

    const handleCreateLeague = async () => {
        const overallStartTime = performance.now();
        console.log('[CreateLeague] 🏆 Starting league creation...');

        // Use username from profile, fallback to email prefix or ID if somehow missing
        const displayName = userProfile?.username || user?.email?.split('@')[0] || user?.id || 'Unknown';

        if (!user || !leagueName || !teamName) {
            console.log('[CreateLeague] ❌ Validation failed: missing fields');
            toast.error("Please fill in all required fields");
            return;
        }

        setLoading(true);
        try {
            // 1. Create the league
            console.log('[CreateLeague] 📝 Step 1: Creating league record...');
            const step1Start = performance.now();

            // Try to create league with tournament fields first
            // Fall back to without them if the migration hasn't been applied yet
            let league: Tables<"leagues"> | null;
            let leagueError: { message: string; details?: string; hint?: string; code?: string } | null;

            const baseLeagueData = {
                name: leagueName,
                league_manager_id: user.id,
                manager_count: managerCount,
                active_size: activeSize,
                bench_size: benchSize,
                min_batsmen: minBatsmen,
                max_batsmen: 6, // Kept for schema compat, or update if we add a slider
                min_bowlers: minBowlers,
                min_wks: minWks,
                min_all_rounders: minAllRounders,
                max_international: selectedTournament.type === 'international' ? 11 : 4, // Allow all international for T20 WC
            };

            // First try with tournament fields
            const resultWithTournament = await supabase
                .from('leagues')
                .insert({
                    ...baseLeagueData,
                    tournament_id: selectedTournament.id,
                    tournament_name: selectedTournament.name
                })
                .select()
                .single();

            if (resultWithTournament.error?.message?.includes('tournament_id')) {
                // Migration not applied yet, try without tournament fields
                console.warn('[CreateLeague] ⚠️ Tournament columns not found, creating without them');
                const resultWithoutTournament = await supabase
                    .from('leagues')
                    .insert(baseLeagueData)
                    .select()
                    .single();
                league = resultWithoutTournament.data;
                leagueError = resultWithoutTournament.error;
            } else {
                league = resultWithTournament.data;
                leagueError = resultWithTournament.error;
            }

            const step1Duration = performance.now() - step1Start;
            console.log(`[CreateLeague] ✅ Step 1 completed in ${step1Duration.toFixed(2)}ms`);

            if (leagueError) {
                console.error('[CreateLeague] ❌ Error creating league:', leagueError);
                throw leagueError;
            }

            if (!league) {
                throw new Error('League creation returned no data');
            }

            // 1b. Insert scoring rules (non-fatal if it fails)
            try {
                const sanitizedRules = sanitizeScoringRules(scoringRules);
                const { error: scoringError } = await supabase
                    .from('scoring_rules')
                    .insert({ league_id: league.id, rules: sanitizedRules as unknown as Json });

                if (scoringError) {
                    console.warn('[CreateLeague] ⚠️ Failed to save scoring rules:', scoringError);
                }
            } catch (e) {
                console.warn('[CreateLeague] ⚠️ Scoring rules insert failed:', e);
            }

            // 2. Create the creator's manager record
            console.log('[CreateLeague] 👤 Step 2: Creating manager record...');
            const step2Start = performance.now();

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
                });

            const step2Duration = performance.now() - step2Start;
            console.log(`[CreateLeague] ✅ Step 2 completed in ${step2Duration.toFixed(2)}ms`);

            if (managerError) {
                console.error('[CreateLeague] ❌ Error creating manager:', managerError);
                throw managerError;
            }

            // 3. Create placeholder teams for the rest
            console.log(`[CreateLeague] 👥 Step 3: Creating ${managerCount - 1} placeholder managers...`);
            const step3Start = performance.now();

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
                });
            }

            let allManagers: (Tables<"managers"> | null)[] = [];
            if (placeholders.length > 0) {
                const { data: createdPlaceholders, error: placeholderError } = await supabase
                    .from('managers')
                    .insert(placeholders)
                    .select();

                if (placeholderError) {
                    console.error('[CreateLeague] ❌ Error creating placeholders:', placeholderError);
                    throw placeholderError;
                }

                // Fetch the creator manager we just made to get its real ID
                const { data: creatorManager } = await supabase
                    .from('managers')
                    .select('*')
                    .eq('league_id', league.id)
                    .eq('user_id', user.id)
                    .single();

                allManagers = [creatorManager, ...(createdPlaceholders || [])];
            } else {
                const { data: creatorManager } = await supabase
                    .from('managers')
                    .select('*')
                    .eq('league_id', league.id)
                    .eq('user_id', user.id)
                    .single();
                allManagers = [creatorManager];
            }

            const step3Duration = performance.now() - step3Start;
            console.log(`[CreateLeague] ✅ Step 3 completed in ${step3Duration.toFixed(2)}ms (created ${allManagers.length} total managers)`);

            // 4. Generate Randomized Schedule (7 Weeks)
            console.log('[CreateLeague] 📅 Step 4: Generating schedule...');
            const step4Start = performance.now();

            const managerIds = allManagers.filter((m): m is Tables<"managers"> => m !== null).map(m => m.id);
            const numTeams = managerIds.length;
            const weeks = selectedTournament.type === 'international' ? 5 : 7;
            interface ScheduleMatchup {
                league_id: string;
                week: number;
                manager1_id: string;
                manager2_id: string;
                manager1_score: number;
                manager2_score: number;
                is_finalized: boolean;
            }
            const matchups: ScheduleMatchup[] = [];

            // Helper to shuffle array
            const shuffle = <T,>(array: T[]): T[] => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            const shuffledIds: (string | null)[] = shuffle([...managerIds]);
            if (numTeams % 2 !== 0) shuffledIds.push(null); // Add BYE if odd

            const n = shuffledIds.length;
            const rounds: (string | null)[][][] = [];

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
                        manager1_id: homeId,
                        manager2_id: awayId,
                        manager1_score: 0,
                        manager2_score: 0,
                        is_finalized: false
                    });
                });
            }

            const step4Duration = performance.now() - step4Start;
            console.log(`[CreateLeague] ✅ Step 4 completed in ${step4Duration.toFixed(2)}ms (generated ${matchups.length} matchups)`);

            // 5. Insert schedule
            console.log('[CreateLeague] 💾 Step 5: Inserting schedule into database...');
            const step5Start = performance.now();

            const { error: scheduleError } = await supabase
                .from('league_schedules')
                .insert(matchups);

            const step5Duration = performance.now() - step5Start;
            console.log(`[CreateLeague] ✅ Step 5 completed in ${step5Duration.toFixed(2)}ms`);

            if (scheduleError) {
                console.error("[CreateLeague] ⚠️  Error creating schedule:", scheduleError);
            }

            // 6. Seed players from tournament
            console.log(`[CreateLeague] 🏏 Step 6: Seeding players from ${selectedTournament.shortName}...`);
            const step6Start = performance.now();

            const seedSuccess = await seedFromTournament(league.id, selectedTournament.id);
            if (!seedSuccess) {
                console.warn('[CreateLeague] ⚠️ Tournament seeding failed, using fallback');
            }

            const step6Duration = performance.now() - step6Start;
            console.log(`[CreateLeague] ✅ Step 6 completed in ${step6Duration.toFixed(2)}ms`);

            // 7. Mark in AuthContext that this is the selected manager
            console.log('[CreateLeague] 🎯 Step 7: Selecting manager...');
            const step7Start = performance.now();

            await selectManager(displayName, league.id);

            const step7Duration = performance.now() - step7Start;
            console.log(`[CreateLeague] ✅ Step 7 completed in ${step7Duration.toFixed(2)}ms`);

            const totalDuration = performance.now() - overallStartTime;
            console.log(`[CreateLeague] 🎉 League creation completed in ${totalDuration.toFixed(2)}ms`);
            console.log(`[CreateLeague] 📊 Breakdown: League:${step1Duration.toFixed(0)}ms, Manager:${step2Duration.toFixed(0)}ms, Placeholders:${step3Duration.toFixed(0)}ms, Schedule:${step4Duration.toFixed(0)}ms, Insert:${step5Duration.toFixed(0)}ms, Players:${step6Duration.toFixed(0)}ms, Select:${step7Duration.toFixed(0)}ms`);

            toast.success("League created successfully!");
            navigate(`/${league.id}`);
        } catch (error: unknown) {
            const duration = performance.now() - overallStartTime;
            console.error(`[CreateLeague] ❌ Error after ${duration.toFixed(2)}ms:`, error);
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`Error: ${message}`);
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
                        <p className="text-muted-foreground text-lg italic">Step {step} of 3: {STEP_LABELS[step - 1]}</p>
                    </div>

                    <Card className="border-2 border-primary/10 shadow-xl overflow-hidden glass-morphism">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="text-2xl">
                                {step === 1 ? 'League Configuration' : step === 2 ? 'Scoring Rules' : 'League Manager Setup'}
                            </CardTitle>
                            <CardDescription>
                                {step === 1
                                    ? 'Set the core structure and constraints for your competition.'
                                    : step === 2
                                        ? 'Configure how fantasy points are awarded. You can change these later.'
                                        : `Logged in as @${userProfile?.username || 'user'}. Choose your team name for this league.`}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="pt-8 space-y-8">
                            {step === 1 && (
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

                                    {/* Tournament Selection */}
                                    <div className="space-y-4">
                                        <Label className="text-base font-semibold">Tournament</Label>
                                        <RadioGroup
                                            value={String(selectedTournament.id)}
                                            onValueChange={(value) => {
                                                const tournament = SUPPORTED_TOURNAMENTS.find(t => t.id === Number(value));
                                                if (tournament) setSelectedTournament(tournament);
                                            }}
                                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                        >
                                            {SUPPORTED_TOURNAMENTS.map((tournament) => (
                                                <Label
                                                    key={tournament.id}
                                                    htmlFor={`tournament-${tournament.id}`}
                                                    className={`
                                                        flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                                                        ${selectedTournament.id === tournament.id
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-border hover:border-primary/50 hover:bg-primary/5'}
                                                    `}
                                                >
                                                    <RadioGroupItem
                                                        value={String(tournament.id)}
                                                        id={`tournament-${tournament.id}`}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            {tournament.type === 'international' ? (
                                                                <Globe className="w-4 h-4 text-blue-500" />
                                                            ) : (
                                                                <Zap className="w-4 h-4 text-yellow-500" />
                                                            )}
                                                            <span className="font-semibold">{tournament.shortName}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {tournament.description}
                                                        </p>
                                                    </div>
                                                </Label>
                                            ))}
                                        </RadioGroup>
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

                                    {/* Position Requirements Section */}
                                    <div className="space-y-6 pt-4 border-t border-primary/10">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-primary" />
                                                Roster Requirements (Minimums)
                                            </h3>
                                            <div className="flex flex-col items-end">
                                                <span className={`text-sm font-bold px-2 py-0.5 rounded-md ${!validationResult.isValid ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                                                    Total: {minWks + minBatsmen + minBowlers + minAllRounders} / {activeSize}
                                                </span>
                                            </div>
                                        </div>

                                        {!validationResult.isValid && (
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Invalid Configuration</AlertTitle>
                                                <AlertDescription>
                                                    {validationResult.message}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label>Min Wicket Keepers</Label>
                                                    <span className="text-sm font-bold bg-muted px-2 rounded">{minWks}</span>
                                                </div>
                                                <Slider value={[minWks]} min={0} max={5} step={1} onValueChange={([v]) => setMinWks(v)} />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label>Min Batsmen</Label>
                                                    <span className="text-sm font-bold bg-muted px-2 rounded">{minBatsmen}</span>
                                                </div>
                                                <Slider value={[minBatsmen]} min={0} max={6} step={1} onValueChange={([v]) => setMinBatsmen(v)} />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label>Min All-Rounders</Label>
                                                    <span className="text-sm font-bold bg-muted px-2 rounded">{minAllRounders}</span>
                                                </div>
                                                <Slider value={[minAllRounders]} min={0} max={6} step={1} onValueChange={([v]) => setMinAllRounders(v)} />
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label>Min Bowlers</Label>
                                                    <span className="text-sm font-bold bg-muted px-2 rounded">{minBowlers}</span>
                                                </div>
                                                <Slider value={[minBowlers]} min={0} max={6} step={1} onValueChange={([v]) => setMinBowlers(v)} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pb-4"></div>

                                </>
                            )}

                            {step === 2 && (
                                <ScoringRulesForm rules={scoringRules} onChange={setScoringRules} />
                            )}

                            {step === 3 && (
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
                            {step > 1 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setStep(step - 1)}
                                    className="flex-1 h-12 text-base"
                                    disabled={loading}
                                >
                                    Back
                                </Button>
                            )}

                            <Button
                                className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                onClick={() => step < 3 ? setStep(step + 1) : handleCreateLeague()}
                                disabled={loading || (step === 1 && (!leagueName || !validationResult.isValid)) || (step === 3 && !teamName)}
                            >
                                {loading ? (
                                    'Creating League...'
                                ) : step < 3 ? (
                                    <>
                                        {step === 1 ? 'Next: Scoring Rules' : 'Next: Team Setup'}
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
