import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_LEAGUE_CONFIG } from '@/lib/roster-validation';
import { useMockStore } from '@/store/useMockStore';
import { Play } from 'lucide-react';

const MockDraftSetup = () => {
    const navigate = useNavigate();
    const createDraft = useMockStore(state => state.createDraft);

    const [managerCount, setManagerCount] = useState(10);
    const [userPosition, setUserPosition] = useState('random');
    const [activeSize, setActiveSize] = useState(DEFAULT_LEAGUE_CONFIG.activeSize);
    const [benchSize, setBenchSize] = useState(DEFAULT_LEAGUE_CONFIG.benchSize);

    const handleStart = () => {
        let position = 1;
        if (userPosition === 'random') {
            position = Math.floor(Math.random() * managerCount) + 1;
        } else {
            position = parseInt(userPosition);
            if (position > managerCount) position = managerCount;
        }

        // We merge with DEFAULT_LEAGUE_CONFIG to get all the caps intact, but override active/bench/managers
        const config = {
            ...DEFAULT_LEAGUE_CONFIG,
            managerCount,
            activeSize,
            benchSize,
        };

        const draftId = createDraft(config, position);
        navigate(`/mock-draft/${draftId}`);
    };

    return (
        <AppLayout title="Mock Draft Setup">
            <div className="max-w-2xl mx-auto p-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configure Mock Draft</CardTitle>
                        <CardDescription>Setup your practice draft against AI opponents</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Number of Teams</Label>
                                <Select value={managerCount.toString()} onValueChange={(val) => setManagerCount(parseInt(val))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[8, 10, 12, 14].map(n => (
                                            <SelectItem key={n} value={n.toString()}>{n} Teams</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Your Draft Position</Label>
                                <Select value={userPosition} onValueChange={setUserPosition}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="random">Randomized</SelectItem>
                                        {Array.from({ length: managerCount }, (_, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>Pick #{i + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Active Roster Size</Label>
                                <Input
                                    type="number"
                                    min={11} max={15}
                                    value={activeSize}
                                    onChange={(e) => setActiveSize(parseInt(e.target.value) || 11)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Bench Size</Label>
                                <Input
                                    type="number"
                                    min={0} max={8}
                                    value={benchSize}
                                    onChange={(e) => setBenchSize(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t p-6">
                        <Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>
                        <Button onClick={handleStart} className="gap-2">
                            <Play className="w-4 h-4" />
                            Start Draft
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </AppLayout>
    );
};

export default MockDraftSetup;
