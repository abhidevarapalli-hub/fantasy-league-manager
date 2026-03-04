import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { WeekManager } from '@/components/admin/WeekManager';

interface League {
  id: string;
  name: string;
}

export const WeekManagerAdmin = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');

  useEffect(() => {
    const fetchLeagues = async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching leagues:', error);
        toast.error('Failed to load leagues');
        return;
      }

      setLeagues(data || []);
    };

    fetchLeagues();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Week Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Assign matches to weeks, auto-generate schedules, and finalize weekly matchups.
        </p>

        <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a league..." />
          </SelectTrigger>
          <SelectContent>
            {leagues.map((league) => (
              <SelectItem key={league.id} value={league.id}>
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLeagueId && <WeekManager leagueId={selectedLeagueId} />}
      </CardContent>
    </Card>
  );
};
