
import { Manager } from "@/lib/supabase-types";
import { Match } from "@/lib/supabase-types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

interface MatchupDetailProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    match: Match;
    homeManager?: Manager;
    awayManager?: Manager;
}

export function MatchupDetail({
    open,
    onOpenChange,
    match,
    homeManager,
    awayManager,
}: MatchupDetailProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Matchup Details</DialogTitle>
                    <DialogDescription>Week {match.week}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-between py-6">
                    <div className="flex flex-col items-center gap-2 flex-1">
                        <span className="font-bold text-lg">{homeManager?.teamName || "TBD"}</span>
                        <span className="text-sm text-muted-foreground">{homeManager?.name || "-"}</span>
                        <span className="text-3xl font-bold">{match.homeScore ?? "-"}</span>
                    </div>

                    <div className="text-muted-foreground font-medium px-4">VS</div>

                    <div className="flex flex-col items-center gap-2 flex-1">
                        <span className="font-bold text-lg">{awayManager?.teamName || "TBD"}</span>
                        <span className="text-sm text-muted-foreground">{awayManager?.name || "-"}</span>
                        <span className="text-3xl font-bold">{match.awayScore ?? "-"}</span>
                    </div>
                </div>

                {/* Placeholder for detailed scoring breakdown if needed later */}
                <div className="text-center text-sm text-muted-foreground mt-4">
                    {match.completed ? "Match Completed" : "Match Scheduled"}
                </div>
            </DialogContent>
        </Dialog>
    );
}
