import { AppLayout } from '@/components/AppLayout';
import { DraftBoard } from '@/components/DraftBoard';
import { MockDraftBoard } from '@/components/MockDraftBoard';
import { useGameStore } from '@/store/useGameStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Draft = () => {
  const loading = useGameStore(state => state.loading);
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AppLayout
      title="Draft Board"
      subtitle="8 teams × 14 rounds snake draft"
      headerActions={
        !isLeagueManager ? <Lock className="w-4 h-4 text-muted-foreground" /> : null
      }
    >
      <div className="px-4 py-4">
        <Tabs defaultValue="official" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="official">Official Draft</TabsTrigger>
            <TabsTrigger value="mock">Mock Draft</TabsTrigger>
          </TabsList>

          <TabsContent value="official" className="mt-0">
            {/* Read-only notice for non-league managers */}
            {!isLeagueManager && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  View only - Only the league manager can modify the draft
                </p>
              </div>
            )}
            <DraftBoard readOnly={!isLeagueManager} />
          </TabsContent>

          <TabsContent value="mock" className="mt-0">
            <MockDraftBoard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Draft;
