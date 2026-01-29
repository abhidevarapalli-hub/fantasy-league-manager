import { useState, useMemo } from 'react';
import { Player } from '@/lib/supabase-types';
import { sortPlayersByPriority } from '@/lib/player-order';
import { useDebounce } from '@/hooks/useDebounce';

export type NationalityFilter = 'All' | 'Domestic' | 'International';
export type RoleFilter = 'All' | 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';

interface UsePlayerFiltersProps {
    players: Player[];
    initialTeam?: string;
    initialRole?: RoleFilter;
    initialNationality?: NationalityFilter;
    initialSearch?: string;
}

export const usePlayerFilters = ({
    players,
    initialTeam = 'All',
    initialRole = 'All',
    initialNationality = 'All',
    initialSearch = '',
}: UsePlayerFiltersProps) => {
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [selectedTeam, setSelectedTeam] = useState(initialTeam);
    const [selectedRole, setSelectedRole] = useState<RoleFilter>(initialRole);
    const [selectedNationality, setSelectedNationality] = useState<NationalityFilter>(initialNationality);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Derive available teams from the players list
    const availableTeams = useMemo(() => {
        const teams = new Set<string>();
        players.forEach(p => {
            if (p.team) teams.add(p.team);
        });
        return ['All', ...Array.from(teams).sort()];
    }, [players]);

    const filteredPlayers = useMemo(() => {
        const filtered = players.filter(player => {
            // Search filter
            const query = debouncedSearchQuery.toLowerCase();
            const matchesSearch = !query ||
                player.name.toLowerCase().includes(query) ||
                player.team.toLowerCase().includes(query);

            // Team filter
            const matchesTeam = selectedTeam === 'All' || player.team === selectedTeam;

            // Role filter
            const matchesRole = selectedRole === 'All' || player.role === selectedRole;

            // Nationality filter
            const matchesNationality = selectedNationality === 'All' ||
                (selectedNationality === 'International' && player.isInternational) ||
                (selectedNationality === 'Domestic' && !player.isInternational);

            return matchesSearch && matchesTeam && matchesRole && matchesNationality;
        });

        return sortPlayersByPriority(filtered);
    }, [players, debouncedSearchQuery, selectedTeam, selectedRole, selectedNationality]);

    const activeFiltersCount = [
        selectedTeam !== 'All' ? selectedTeam : null,
        selectedRole !== 'All' ? selectedRole : null,
        selectedNationality !== 'All' ? selectedNationality : null,
        debouncedSearchQuery ? 'Search' : null
    ].filter(Boolean).length;

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedTeam('All');
        setSelectedRole('All');
        setSelectedNationality('All');
    };

    return {
        // State
        searchQuery,
        selectedTeam,
        selectedRole,
        selectedNationality,
        debouncedSearchQuery,

        // Setters
        setSearchQuery,
        setSelectedTeam,
        setSelectedRole,
        setSelectedNationality,

        // Results
        filteredPlayers,
        availableTeams,
        activeFiltersCount,

        // Actions
        clearFilters,
    };
};
