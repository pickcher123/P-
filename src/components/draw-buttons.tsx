import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Gem } from 'lucide-react';

import { CardPool } from '@/types/draw';

interface DrawButtonsProps {
    isLoadingStats: boolean;
    isLimitReachedForSingle: boolean;
    canDraw3: boolean;
    cardPool: CardPool | null;
    performDraw: (count: number) => void;
}

export function DrawButtons({
    isLoadingStats,
    isLimitReachedForSingle,
    canDraw3,
    cardPool,
    performDraw
}: DrawButtonsProps) {
    if (isLimitReachedForSingle) {
        return (
            <Button disabled className="w-full h-14 text-sm font-black rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                今日次數已用完
            </Button>
        );
    }

    return (
        <div className="flex gap-2 w-full">
            <Button 
                className={cn(
                    "flex-1 h-14 text-sm font-black border-2 transition-all shadow-xl rounded-2xl flex items-center justify-center gap-2 px-2",
                    isLoadingStats ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50" : "bg-slate-900 text-white border-white/10 hover:border-primary/50 hover:bg-slate-800"
                )}
                onClick={() => performDraw(1)} 
                disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 1}
            >
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                    <>
                        <span className="text-[10px] opacity-70">單抽</span>
                        <span className="text-sm flex items-center font-headline"><Gem className="w-3 h-3 mr-1 text-sky-400"/>{cardPool?.price}</span>
                    </>
                }
            </Button>
            <Button 
                className={cn(
                    "flex-1 h-14 text-sm font-black rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 px-2",
                    (isLoadingStats || !canDraw3) ? "bg-slate-800 text-slate-500 border border-slate-700 opacity-50" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => performDraw(3)} 
                disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 3 || !canDraw3}
            >
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : !canDraw3 ? '今日額度不足' : 
                    <>
                        <span className="text-[10px] opacity-90">3 連抽</span>
                        <span className="text-sm flex items-center font-headline"><Gem className="w-3 h-3 mr-1"/>{cardPool?.price3Draws}</span>
                    </>
                }
            </Button>
        </div>
    );
}
