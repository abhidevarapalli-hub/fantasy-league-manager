import { useState, useEffect } from 'react';
import { Link2, Search, Check, X, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useGameStore } from '@/store/useGameStore';
import { supabase } from '@/integrations/supabase/client';
import { searchPlayer, getPlayerProfileUrl } from '@/lib/cricbuzz-api';

interface PlayerWithMapping {
  id: string;
  name: string;
  team: string;
  role: string;
  cricbuzzId: string | null;
}

interface CricbuzzSearchResult {
  id: number;
  name: string;
  teamName?: string;
  faceImageId?: number;
}

export const PlayerMapping = () => {
  const players = useGameStore(state => state.players);
  const currentLeagueId = useGameStore(state => state.currentLeagueId);

  const [playersWithMapping, setPlayersWithMapping] = useState<PlayerWithMapping[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithMapping | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CricbuzzSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  const [filterUnmapped, setFilterUnmapped] = useState(false);

  // Load existing mappings
  useEffect(() => {
    if (!currentLeagueId) return;

    const loadMappings = async () => {
      const { data: extendedPlayers } = await supabase
        .from('extended_players' as any)
        .select('player_id, cricbuzz_id');

      const mappingMap = new Map<string, string>();
      if (extendedPlayers) {
        for (const ep of extendedPlayers) {
          mappingMap.set(ep.player_id, ep.cricbuzz_id);
        }
      }

      setPlayersWithMapping(
        players.map(p => ({
          id: p.id,
          name: p.name,
          team: p.team,
          role: p.role,
          cricbuzzId: mappingMap.get(p.id) || null,
        }))
      );
    };

    loadMappings();
  }, [players, currentLeagueId]);

  // Search Cricbuzz for players
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await searchPlayer(searchQuery);
      setSearchResults(results);

      if (results.length === 0) {
        toast.info('No players found. Try a different search term or enter ID manually.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Enter Cricbuzz ID manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Save mapping
  const handleSaveMapping = async (cricbuzzId: string, playerName?: string, imageId?: number) => {
    if (!selectedPlayer) return;

    setIsSaving(true);
    try {
      // Upsert the mapping
      const { error } = await supabase
        .from('extended_players')
        .upsert(
          {
            player_id: selectedPlayer.id,
            cricbuzz_id: cricbuzzId,
            image_id: imageId,
          },
          {
            onConflict: 'player_id',
          }
        );

      if (error) {
        console.error('Error saving mapping:', error);
        toast.error('Failed to save mapping');
        return;
      }

      // Update local state
      setPlayersWithMapping(prev =>
        prev.map(p =>
          p.id === selectedPlayer.id ? { ...p, cricbuzzId } : p
        )
      );

      toast.success(`Mapped ${selectedPlayer.name} to Cricbuzz ID ${cricbuzzId}`);
      setDialogOpen(false);
      setSelectedPlayer(null);
      setSearchQuery('');
      setSearchResults([]);
      setManualId('');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove mapping
  const handleRemoveMapping = async (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const { error } = await supabase
      .from('extended_players')
      .delete()
      .eq('player_id', playerId);

    if (error) {
      toast.error('Failed to remove mapping');
      return;
    }

    setPlayersWithMapping(prev =>
      prev.map(p => (p.id === playerId ? { ...p, cricbuzzId: null } : p))
    );
    toast.success('Mapping removed');
  };

  // Open profile in new tab
  const openProfile = (cricbuzzId: string, playerName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = getPlayerProfileUrl(cricbuzzId, playerName);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const mappedCount = playersWithMapping.filter(p => p.cricbuzzId).length;
  const unmappedCount = playersWithMapping.length - mappedCount;

  const displayedPlayers = filterUnmapped
    ? playersWithMapping.filter(p => !p.cricbuzzId)
    : playersWithMapping;

  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground italic">Player Mapping</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-500">
            {mappedCount} Mapped
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer transition-colors ${filterUnmapped
              ? 'bg-yellow-500 text-yellow-950'
              : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
              }`}
            onClick={() => setFilterUnmapped(!filterUnmapped)}
          >
            {unmappedCount} Unmapped
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Map your league players to their Cricbuzz profiles to enable automatic stats import.
        Click on unmapped badge to filter.
      </p>

      <ScrollArea className="h-96">
        <div className="space-y-2">
          {displayedPlayers.map(player => (
            <div
              key={player.id}
              className={`p-3 rounded-lg border ${player.cricbuzzId
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-yellow-500/30 bg-yellow-500/5'
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{player.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {player.team}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {player.role}
                    </Badge>
                  </div>
                  {player.cricbuzzId && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Cricbuzz ID: {player.cricbuzzId}
                      </span>
                      <button
                        onClick={(e) => openProfile(player.cricbuzzId!, player.name, e)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        View Profile <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {player.cricbuzzId ? (
                    <>
                      <Badge className="bg-green-500">
                        <Check className="w-3 h-3 mr-1" />
                        Mapped
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleRemoveMapping(player.id, e)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Dialog
                      open={dialogOpen && selectedPlayer?.id === player.id}
                      onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (open) {
                          setSelectedPlayer(player);
                          setSearchQuery(player.name);
                        } else {
                          setSelectedPlayer(null);
                          setSearchResults([]);
                          setManualId('');
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Link2 className="w-4 h-4 mr-1" />
                          Map
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Map {player.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* Search */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Search Cricbuzz..."
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <Button onClick={handleSearch} disabled={isSearching}>
                              {isSearching ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                            </Button>
                          </div>

                          {/* Search Results */}
                          {searchResults.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Select a player:</p>
                              <ScrollArea className="max-h-48">
                                {searchResults.map(result => (
                                  <div
                                    key={result.id}
                                    className="p-2 rounded border cursor-pointer hover:bg-muted mb-1"
                                    onClick={() => handleSaveMapping(result.id.toString(), result.name, result.faceImageId)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <span className="font-medium">{result.name}</span>
                                        {result.teamName && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            ({result.teamName})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          ID: {result.id}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openProfile(result.id.toString(), result.name, e);
                                          }}
                                          className="text-primary"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </ScrollArea>
                            </div>
                          )}

                          {/* Manual ID Entry */}
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Or enter Cricbuzz ID manually:
                            </p>
                            <div className="flex gap-2">
                              <Input
                                placeholder="e.g., 1413"
                                value={manualId}
                                onChange={e => setManualId(e.target.value)}
                              />
                              <Button
                                onClick={() => handleSaveMapping(manualId)}
                                disabled={!manualId || isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                Save
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Find the ID from Cricbuzz player URLs:
                              <br />
                              cricbuzz.com/profiles/<strong>1413</strong>/virat-kohli
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
};

export default PlayerMapping;
