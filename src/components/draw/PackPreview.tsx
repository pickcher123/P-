import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons';
import { Gem, ShieldCheck, AlertCircle, Ban, PlayCircle, Loader2 } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

import { CardPool } from '@/types/draw';

export function PackPreview({
    cardPool,
    initialDrawCount,
    isLevelMet,
    isLimitReachedForInitial,
    isLoadingStats,
    performDraw
}: {
    cardPool: CardPool,
    initialDrawCount: number,
    isLevelMet: boolean,
    isLimitReachedForInitial: boolean,
    isLoadingStats: boolean,
    performDraw: (count: number) => void
}) {
    const cost = initialDrawCount === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * initialDrawCount;

    return (
        <div className="flex flex-col items-center min-h-screen p-2 pt-10 md:pt-32 relative select-none">
            <div className="w-full max-w-[340px] space-y-4 animate-fade-in-up">
                <div className="relative p-2 bg-slate-900 border-[6px] border-slate-950 rounded-[2rem] shadow-2xl overflow-hidden">
                    <div className="bg-black rounded-[1.5rem] border-[6px] border-slate-950 overflow-hidden p-4 space-y-4 text-center">
                        <Logo className="mx-auto scale-75" asStatic />
                        <h2 className="text-xs md:text-base font-headline font-black text-white uppercase truncate px-2">{cardPool.name}</h2>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-white/5 rounded-xl border border-white/10"><span className="text-[7px] text-muted-foreground font-black block uppercase">本次抽數</span><span className="text-base font-black text-white">{initialDrawCount} 包</span></div>
                            <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                                <span className="text-[7px] text-muted-foreground font-black block uppercase">花費金額</span>
                                <div className="flex items-center justify-center gap-1 text-base font-black text-white">
                                    {cardPool.currency === 'p-point' ? 
                                        <><PPlusIcon className="w-3 h-3 text-sky-400" />{cost}</> : 
                                        <><Gem className="w-3 h-3 text-sky-400" /> {cost}</>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {cardPool.minLevel && cardPool.minLevel !== '新手收藏家' && (
                                <div className={cn("p-2 rounded-xl border flex items-center justify-center gap-2", isLevelMet ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-rose-500/10 border-rose-500/30 text-rose-500")}><ShieldCheck className="w-3 h-3" /><span className="text-[9px] font-black uppercase">等級限制: {cardPool.minLevel}</span></div>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 px-2">
                            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col items-center text-center gap-2">
                                <div className="flex items-center gap-1.5 justify-center mb-1"><AlertCircle className="w-4 h-4 text-destructive" /><p className="text-[11px] font-black text-destructive uppercase">購買條款告知</p></div>
                                <ul className="text-[11px] text-white/80 font-bold space-y-1.5 text-left list-none pl-0">
                                    <li>● 本站商品屬機率型抽選及數位內容，購買後即視為參與活動。</li>
                                    <li>● 本服務經提供即完成，依《消保法》不適用七日鑑賞期。</li>
                                    <li>● 在進行購買前,您需要完全同意本站的購買規則。</li>
                                    <li>● 啟動開獎之後,代表您完全同意本站的購買規則。</li>
                                </ul>
                            </div>
                        </div>
                    <div className="mt-3 px-1.5 pb-1.5">
                        <Button
                            size="lg"
                            className={cn(
                                "w-full h-14 text-xl font-black rounded-xl shadow-xl transition-all",
                                (isLevelMet && !isLimitReachedForInitial && !isLoadingStats) ? "bg-primary text-primary-foreground border-b-[6px] border-slate-950 active:translate-y-1 active:border-b-0" : "bg-slate-800 text-slate-500 border-slate-700"
                            )}
                            onClick={() => (isLevelMet && !isLimitReachedForInitial && !isLoadingStats) ? performDraw(initialDrawCount) : null}
                            disabled={!isLevelMet || isLimitReachedForInitial || isLoadingStats}
                        >
                            {isLoadingStats ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : isLimitReachedForInitial ? <Ban className="mr-2 h-6 w-6" /> : isLevelMet ? <PlayCircle className="mr-2 h-6 w-6" /> : <Ban className="mr-2 h-6 w-6" />}
                            {isLoadingStats ? '驗證紀錄中...' : isLimitReachedForInitial ? '今日次數已用完' : isLevelMet ? '啟動開獎' : '權限不足'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
