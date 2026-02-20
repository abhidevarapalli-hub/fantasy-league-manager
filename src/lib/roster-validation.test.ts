import { describe, it, expect } from 'vitest';
import { buildOptimalActive11, LeagueConfig } from './roster-validation';
import { Player } from './supabase-types';

const DEFAULT_CONFIG: LeagueConfig = {
    managerCount: 8,
    activeSize: 11,
    benchSize: 3,
    minBatWk: 4,
    maxBatWk: 7,
    minBowlers: 3,
    maxBowlers: 6,
    minAllRounders: 2,
    maxAllRounders: 4,
    maxInternational: 4,
    requireWk: true,
};

const createPlayer = (id: string, role: Player['role'], isInternational: boolean = false): Player => ({
    id,
    name: `Player ${id}`,
    team: 'Team A',
    role,
    isInternational,
});

describe('buildOptimalActive11', () => {
    it('fills a perfect roster correctly', () => {
        const players: Player[] = [
            createPlayer('1', 'Wicket Keeper'),
            createPlayer('2', 'Batsman'),
            createPlayer('3', 'Batsman'),
            createPlayer('4', 'Batsman'),
            createPlayer('5', 'All Rounder'),
            createPlayer('6', 'All Rounder'),
            createPlayer('7', 'Bowler'),
            createPlayer('8', 'Bowler'),
            createPlayer('9', 'Bowler'),
            createPlayer('10', 'Batsman'), // Flex
            createPlayer('11', 'Bowler'), // Flex
            createPlayer('12', 'All Rounder'), // Bench
        ];

        const { active, bench } = buildOptimalActive11(players, DEFAULT_CONFIG);

        expect(active).toHaveLength(11);
        expect(bench).toHaveLength(1);
        expect(active.filter(p => p.role === 'Wicket Keeper')).toHaveLength(1);
        expect(active.filter(p => p.role === 'Batsman')).toHaveLength(4);
        expect(active.filter(p => p.role === 'All Rounder')).toHaveLength(2);
        expect(active.filter(p => p.role === 'Bowler')).toHaveLength(4); // 3 mandatory + 1 flex
    });

    it('leaves vacant spots if requirements are not met', () => {
        const players: Player[] = [
            createPlayer('1', 'Wicket Keeper'),
            createPlayer('2', 'Batsman'),
            createPlayer('3', 'Batsman'),
            // Missing 1 BAT/WK (needs 4 total)
            createPlayer('5', 'All Rounder'),
            createPlayer('6', 'All Rounder'),
            // Missing 1 BOWL (needs 3 total)
            createPlayer('7', 'Bowler'),
            createPlayer('8', 'Bowler'),
            // Extra players that should go to flex or bench
            createPlayer('10', 'All Rounder'),
            createPlayer('11', 'All Rounder'),
            createPlayer('12', 'All Rounder'),
            createPlayer('13', 'All Rounder'),
        ];

        const { active, bench } = buildOptimalActive11(players, DEFAULT_CONFIG);

        // Mandatory: 1 WK, 2 BAT (Total 3 of 4 BAT/WK), 2 AR (Total 2 of 2 AR), 2 BOWL (Total 2 of 3 BOWL)
        // Total mandatory filled: 3 + 2 + 2 = 7
        // Remaining flex: 11 - (4 + 2 + 3) = 2
        // ARs available for flex: 10, 11
        // Total active: 7 + 2 = 9
        // Bench: 12, 13

        expect(active).toHaveLength(9);
        expect(bench).toHaveLength(2);
        expect(active.filter(p => p.role === 'Wicket Keeper')).toHaveLength(1);
        expect(active.filter(p => p.role === 'Batsman')).toHaveLength(2);
        expect(active.filter(p => p.role === 'All Rounder')).toHaveLength(4); // 2 mandatory + 2 flex
        expect(active.filter(p => p.role === 'Bowler')).toHaveLength(2);
    });

    it('respects the 4-international limit', () => {
        const players: Player[] = [
            createPlayer('1', 'Wicket Keeper', true),
            createPlayer('2', 'Batsman', true),
            createPlayer('3', 'Batsman', true),
            createPlayer('4', 'Batsman', true),
            createPlayer('5', 'Batsman', true), // Should be skipped for mandatory
            createPlayer('6', 'All Rounder'),
            createPlayer('7', 'All Rounder'),
            createPlayer('8', 'Bowler'),
            createPlayer('9', 'Bowler'),
            createPlayer('10', 'Bowler'),
        ];

        const { active } = buildOptimalActive11(players, DEFAULT_CONFIG);

        expect(active.filter(p => p.isInternational)).toHaveLength(4);
        expect(active.find(p => p.id === '5')).toBeUndefined();
    });

    it('handles requirement for WK separately', () => {
        const players: Player[] = [
            createPlayer('1', 'Batsman'),
            createPlayer('2', 'Batsman'),
            createPlayer('3', 'Batsman'),
            createPlayer('4', 'Batsman'),
            createPlayer('5', 'All Rounder'),
            createPlayer('6', 'All Rounder'),
            createPlayer('7', 'Bowler'),
            createPlayer('8', 'Bowler'),
            createPlayer('9', 'Bowler'),
        ];

        const { active } = buildOptimalActive11(players, DEFAULT_CONFIG);

        // Should have 0 Wicket Keepers in active, and total BAT/WK = 4
        expect(active.filter(p => p.role === 'Wicket Keeper')).toHaveLength(0);
        expect(active.filter(p => p.role === 'Batsman')).toHaveLength(4);
        expect(active).toHaveLength(9); // 4 BAT + 2 AR + 3 BOWL = 9. 2 flex vacant.
    });
});
