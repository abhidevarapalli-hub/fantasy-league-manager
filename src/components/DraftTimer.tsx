import { useState, useRef, useEffect } from 'react';
import { Timer, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DraftTimerProps {
    getRemainingTime: () => number;
    isActive: boolean;
    isPaused: boolean;
    className?: string;
    currentTeamName?: string;
    isMyTurn?: boolean;
}

export const DraftTimer = ({ getRemainingTime, isActive, isPaused, className, currentTeamName, isMyTurn }: DraftTimerProps) => {
    const [timeLeft, setTimeLeft] = useState(getRemainingTime());
    const timerRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (isActive && !isPaused) {
            timerRef.current = setInterval(() => {
                setTimeLeft(getRemainingTime());
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeLeft(getRemainingTime());
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, isPaused, getRemainingTime]);

    // Update immediately when state changes
    useEffect(() => {
        setTimeLeft(getRemainingTime());
    }, [getRemainingTime]);

    const seconds = Math.ceil(timeLeft / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const isCritical = seconds < 15;

    if (!isActive) return null;

    return (
        <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg transition-all duration-500",
            isPaused ? "bg-muted border-border text-muted-foreground" :
                isCritical ? "bg-red-500 border-red-600 text-white animate-pulse" :
                    isMyTurn ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/20" :
                        "bg-primary border-primary-foreground/20 text-primary-foreground",
            className
        )}>
            <Timer className={cn("w-5 h-5", !isPaused && "animate-spin-slow")} />
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold leading-none opacity-80 max-w-[120px] truncate">
                    {isPaused ? "Paused" : (isMyTurn ? "Your Pick" : (currentTeamName ? `${currentTeamName}` : "Pick Clock"))}
                </span>
                <span className="text-xl font-mono font-black leading-none mt-0.5">
                    {minutes}:{remainingSeconds.toString().padStart(2, '0')}
                </span>
            </div>
            {isCritical && !isPaused && (
                <AlertCircle className="w-5 h-5 animate-bounce" />
            )}
        </div>
    );
};
