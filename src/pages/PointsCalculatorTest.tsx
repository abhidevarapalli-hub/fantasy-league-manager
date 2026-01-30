import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  calculateFantasyPoints,
  formatPointsBreakdown,
  type PlayerStats,
  type PointsBreakdown,
} from '@/lib/fantasy-points-calculator';
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-types';

// Mock data from real matches (NZ vs IND 2nd T20I)
const MOCK_PLAYERS = [
  {
    name: 'Suryakumar Yadav',
    team: 'IND',
    stats: {
      runs: 82,
      ballsFaced: 37,
      fours: 9,
      sixes: 4,
      isOut: false,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: true,
    } as PlayerStats,
  },
  {
    name: 'Ishan Kishan',
    team: 'IND',
    stats: {
      runs: 76,
      ballsFaced: 32,
      fours: 11,
      sixes: 4,
      isOut: true,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: true,
    } as PlayerStats,
  },
  {
    name: 'Kuldeep Yadav',
    team: 'IND',
    stats: {
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      overs: 4,
      maidens: 0,
      runsConceded: 35,
      wickets: 2,
      dots: 10,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: true,
    } as PlayerStats,
  },
  {
    name: 'Hardik Pandya',
    team: 'IND',
    stats: {
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      overs: 3,
      maidens: 0,
      runsConceded: 25,
      wickets: 1,
      dots: 6,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 3,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: true,
    } as PlayerStats,
  },
  {
    name: 'Mitchell Santner',
    team: 'NZ',
    stats: {
      runs: 47,
      ballsFaced: 27,
      fours: 6,
      sixes: 1,
      isOut: false,
      overs: 2,
      maidens: 0,
      runsConceded: 27,
      wickets: 0,
      dots: 4,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: false,
    } as PlayerStats,
  },
  {
    name: 'Rachin Ravindra',
    team: 'NZ',
    stats: {
      runs: 44,
      ballsFaced: 26,
      fours: 2,
      sixes: 4,
      isOut: true,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
      lbwBowledCount: 0,
      catches: 1,
      stumpings: 0,
      runOuts: 0,
      isInPlaying11: true,
      isImpactPlayer: false,
      isManOfMatch: false,
      teamWon: false,
    } as PlayerStats,
  },
];

const defaultStats: PlayerStats = {
  runs: 0,
  ballsFaced: 0,
  fours: 0,
  sixes: 0,
  isOut: false,
  overs: 0,
  maidens: 0,
  runsConceded: 0,
  wickets: 0,
  dots: 0,
  wides: 0,
  noBalls: 0,
  lbwBowledCount: 0,
  catches: 0,
  stumpings: 0,
  runOuts: 0,
  isInPlaying11: true,
  isImpactPlayer: false,
  isManOfMatch: false,
  teamWon: false,
};

function PointsDisplay({ breakdown }: { breakdown: PointsBreakdown }) {
  return (
    <div className="space-y-3">
      {breakdown.common.total !== 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1">Common</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.common.starting11 > 0 && (
              <Badge variant="secondary">Playing XI: +{breakdown.common.starting11}</Badge>
            )}
            {breakdown.common.matchWinningTeam > 0 && (
              <Badge variant="secondary">Winning Team: +{breakdown.common.matchWinningTeam}</Badge>
            )}
            {breakdown.common.manOfTheMatch > 0 && (
              <Badge className="bg-yellow-500">MoM: +{breakdown.common.manOfTheMatch}</Badge>
            )}
            {breakdown.common.impactPlayer > 0 && (
              <Badge variant="secondary">Impact: +{breakdown.common.impactPlayer}</Badge>
            )}
          </div>
        </div>
      )}

      {breakdown.batting.total !== 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1">Batting</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.batting.runs > 0 && (
              <Badge variant="outline">Runs: +{breakdown.batting.runs}</Badge>
            )}
            {breakdown.batting.fours > 0 && (
              <Badge variant="outline">4s: +{breakdown.batting.fours}</Badge>
            )}
            {breakdown.batting.sixes > 0 && (
              <Badge variant="outline">6s: +{breakdown.batting.sixes}</Badge>
            )}
            {breakdown.batting.milestoneBonus > 0 && (
              <Badge className="bg-blue-500">Milestone: +{breakdown.batting.milestoneBonus}</Badge>
            )}
            {breakdown.batting.strikeRateBonus > 0 && (
              <Badge className="bg-green-500">SR Bonus: +{breakdown.batting.strikeRateBonus}</Badge>
            )}
            {breakdown.batting.strikeRateBonus < 0 && (
              <Badge variant="destructive">SR Penalty: {breakdown.batting.strikeRateBonus}</Badge>
            )}
            {breakdown.batting.duckPenalty < 0 && (
              <Badge variant="destructive">Duck: {breakdown.batting.duckPenalty}</Badge>
            )}
            {breakdown.batting.lowScorePenalty < 0 && (
              <Badge variant="destructive">Low Score: {breakdown.batting.lowScorePenalty}</Badge>
            )}
          </div>
        </div>
      )}

      {breakdown.bowling.total !== 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1">Bowling</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.bowling.wickets > 0 && (
              <Badge variant="outline">Wickets: +{breakdown.bowling.wickets}</Badge>
            )}
            {breakdown.bowling.milestoneBonus > 0 && (
              <Badge className="bg-blue-500">Milestone: +{breakdown.bowling.milestoneBonus}</Badge>
            )}
            {breakdown.bowling.dots > 0 && (
              <Badge variant="outline">Dots: +{breakdown.bowling.dots}</Badge>
            )}
            {breakdown.bowling.maidens > 0 && (
              <Badge className="bg-purple-500">Maidens: +{breakdown.bowling.maidens}</Badge>
            )}
            {breakdown.bowling.lbwBowledBonus > 0 && (
              <Badge variant="outline">LBW/Bowled: +{breakdown.bowling.lbwBowledBonus}</Badge>
            )}
            {breakdown.bowling.economyBonus > 0 && (
              <Badge className="bg-green-500">Econ Bonus: +{breakdown.bowling.economyBonus}</Badge>
            )}
            {breakdown.bowling.economyBonus < 0 && (
              <Badge variant="destructive">Econ Penalty: {breakdown.bowling.economyBonus}</Badge>
            )}
            {breakdown.bowling.widePenalty < 0 && (
              <Badge variant="destructive">Wides: {breakdown.bowling.widePenalty}</Badge>
            )}
            {breakdown.bowling.noBallPenalty < 0 && (
              <Badge variant="destructive">No Balls: {breakdown.bowling.noBallPenalty}</Badge>
            )}
          </div>
        </div>
      )}

      {breakdown.fielding.total !== 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-1">Fielding</h4>
          <div className="flex flex-wrap gap-2">
            {breakdown.fielding.catches > 0 && (
              <Badge variant="outline">Catches: +{breakdown.fielding.catches}</Badge>
            )}
            {breakdown.fielding.stumpings > 0 && (
              <Badge variant="outline">Stumpings: +{breakdown.fielding.stumpings}</Badge>
            )}
            {breakdown.fielding.runOuts > 0 && (
              <Badge variant="outline">Run Outs: +{breakdown.fielding.runOuts}</Badge>
            )}
            {breakdown.fielding.multiCatchBonus > 0 && (
              <Badge className="bg-orange-500">Multi-Catch: +{breakdown.fielding.multiCatchBonus}</Badge>
            )}
          </div>
        </div>
      )}

      <Separator />
      <div className="flex justify-between items-center">
        <span className="font-semibold">Total Points</span>
        <span className={`text-2xl font-bold ${breakdown.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {breakdown.total}
        </span>
      </div>
    </div>
  );
}

export default function PointsCalculatorTest() {
  const [customStats, setCustomStats] = useState<PlayerStats>(defaultStats);
  const [customBreakdown, setCustomBreakdown] = useState<PointsBreakdown | null>(null);

  const handleCustomCalculate = () => {
    const breakdown = calculateFantasyPoints(customStats, DEFAULT_SCORING_RULES);
    setCustomBreakdown(breakdown);
  };

  const updateCustomStat = <K extends keyof PlayerStats>(key: K, value: PlayerStats[K]) => {
    setCustomStats(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Fantasy Points Calculator Test</h1>
        <p className="text-muted-foreground mt-2">
          Test the points calculator with mock data from NZ vs IND 2nd T20I
        </p>
      </div>

      {/* Mock Players Section */}
      <Card>
        <CardHeader>
          <CardTitle>Mock Player Data (NZ vs IND - Jan 23, 2026)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_PLAYERS.map((player, idx) => {
              const breakdown = calculateFantasyPoints(player.stats, DEFAULT_SCORING_RULES);
              return (
                <Card key={idx} className="border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{player.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">{player.team}</Badge>
                      </div>
                      <Badge className={player.stats.teamWon ? 'bg-green-500' : 'bg-gray-500'}>
                        {player.stats.teamWon ? 'Won' : 'Lost'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-3 space-y-1">
                      {player.stats.runs > 0 && (
                        <p>Batting: {player.stats.runs}({player.stats.ballsFaced}) | {player.stats.fours}x4 {player.stats.sixes}x6</p>
                      )}
                      {player.stats.overs > 0 && (
                        <p>Bowling: {player.stats.wickets}/{player.stats.runsConceded} ({player.stats.overs} ov)</p>
                      )}
                      {(player.stats.catches > 0 || player.stats.stumpings > 0 || player.stats.runOuts > 0) && (
                        <p>Fielding: {player.stats.catches}c {player.stats.stumpings}st {player.stats.runOuts}ro</p>
                      )}
                    </div>
                    <PointsDisplay breakdown={breakdown} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Calculator Section */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="space-y-6">
              {/* Context Switches */}
              <div className="space-y-4">
                <h3 className="font-semibold">Match Context</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="playing11"
                      checked={customStats.isInPlaying11}
                      onCheckedChange={(v) => updateCustomStat('isInPlaying11', v)}
                    />
                    <Label htmlFor="playing11">Playing XI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="teamWon"
                      checked={customStats.teamWon}
                      onCheckedChange={(v) => updateCustomStat('teamWon', v)}
                    />
                    <Label htmlFor="teamWon">Team Won</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isOut"
                      checked={customStats.isOut}
                      onCheckedChange={(v) => updateCustomStat('isOut', v)}
                    />
                    <Label htmlFor="isOut">Out</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="mom"
                      checked={customStats.isManOfMatch}
                      onCheckedChange={(v) => updateCustomStat('isManOfMatch', v)}
                    />
                    <Label htmlFor="mom">Man of Match</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="impact"
                      checked={customStats.isImpactPlayer}
                      onCheckedChange={(v) => updateCustomStat('isImpactPlayer', v)}
                    />
                    <Label htmlFor="impact">Impact Player</Label>
                  </div>
                </div>
              </div>

              {/* Batting Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold">Batting</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="runs">Runs</Label>
                    <Input
                      id="runs"
                      type="number"
                      value={customStats.runs}
                      onChange={(e) => updateCustomStat('runs', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="balls">Balls</Label>
                    <Input
                      id="balls"
                      type="number"
                      value={customStats.ballsFaced}
                      onChange={(e) => updateCustomStat('ballsFaced', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fours">Fours</Label>
                    <Input
                      id="fours"
                      type="number"
                      value={customStats.fours}
                      onChange={(e) => updateCustomStat('fours', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sixes">Sixes</Label>
                    <Input
                      id="sixes"
                      type="number"
                      value={customStats.sixes}
                      onChange={(e) => updateCustomStat('sixes', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Bowling Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold">Bowling</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="overs">Overs</Label>
                    <Input
                      id="overs"
                      type="number"
                      step="0.1"
                      value={customStats.overs}
                      onChange={(e) => updateCustomStat('overs', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="runsConceded">Runs</Label>
                    <Input
                      id="runsConceded"
                      type="number"
                      value={customStats.runsConceded}
                      onChange={(e) => updateCustomStat('runsConceded', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wickets">Wickets</Label>
                    <Input
                      id="wickets"
                      type="number"
                      value={customStats.wickets}
                      onChange={(e) => updateCustomStat('wickets', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maidens">Maidens</Label>
                    <Input
                      id="maidens"
                      type="number"
                      value={customStats.maidens}
                      onChange={(e) => updateCustomStat('maidens', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dots">Dots</Label>
                    <Input
                      id="dots"
                      type="number"
                      value={customStats.dots}
                      onChange={(e) => updateCustomStat('dots', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wides">Wides</Label>
                    <Input
                      id="wides"
                      type="number"
                      value={customStats.wides}
                      onChange={(e) => updateCustomStat('wides', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="noBalls">No Balls</Label>
                    <Input
                      id="noBalls"
                      type="number"
                      value={customStats.noBalls}
                      onChange={(e) => updateCustomStat('noBalls', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lbw">LBW/Bowled</Label>
                    <Input
                      id="lbw"
                      type="number"
                      value={customStats.lbwBowledCount}
                      onChange={(e) => updateCustomStat('lbwBowledCount', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Fielding Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold">Fielding</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="catches">Catches</Label>
                    <Input
                      id="catches"
                      type="number"
                      value={customStats.catches}
                      onChange={(e) => updateCustomStat('catches', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stumpings">Stumpings</Label>
                    <Input
                      id="stumpings"
                      type="number"
                      value={customStats.stumpings}
                      onChange={(e) => updateCustomStat('stumpings', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="runOuts">Run Outs</Label>
                    <Input
                      id="runOuts"
                      type="number"
                      value={customStats.runOuts}
                      onChange={(e) => updateCustomStat('runOuts', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleCustomCalculate} className="w-full">
                Calculate Points
              </Button>
            </div>

            {/* Results */}
            <div>
              {customBreakdown ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Points Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PointsDisplay breakdown={customBreakdown} />
                    <Separator className="my-4" />
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-60">
                      {formatPointsBreakdown(customBreakdown)}
                    </pre>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Enter stats and click Calculate to see the breakdown
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Rules Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Rules Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Common</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>Playing XI: +5</li>
                <li>Winning Team: +5</li>
                <li>Impact Player: +5</li>
                <li>Impact Win Bonus: +5</li>
                <li>Man of Match: +50</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Batting</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>Per Run: +1</li>
                <li>Per Four: +1</li>
                <li>Per Six: +2</li>
                <li>25 runs: +10, 40: +15, 60: +20</li>
                <li>80 runs: +25, 100: +40, 150: +80</li>
                <li>Duck: -10</li>
                <li>SR &lt;100 (10+ balls): -30</li>
                <li>SR &gt;200 (10+ runs): +30</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Bowling</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>Per Wicket: +30</li>
                <li>2W: +10, 3W: +20, 4W: +30</li>
                <li>5W: +40, 6W: +60</li>
                <li>Per Dot: +1</li>
                <li>LBW/Bowled: +5</li>
                <li>Maiden: +40</li>
                <li>ER &lt;4 (2+ ov): +40</li>
                <li>ER &gt;10 (2+ ov): -15</li>
                <li>Wide: -1, No Ball: -5</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Fielding</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>Catch: +10</li>
                <li>Stumping: +20</li>
                <li>Run Out: +10</li>
                <li>2+ Catches: +10 bonus</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
