'use client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Gem, Trophy, Package, ChevronDown, ChevronUp, Sparkles, ChevronRight, Settings, Disc3, Info } from 'lucide-react';
import { LuckyBagIcon, PPlusIcon } from '@/components/icons';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, getDocs, orderBy, doc, getCountFromServer } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SystemConfig } from '@/types/system';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LuckBagStatus = 'draft' | 'published' | '已開獎';

export interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    imageHint: string;
    backImageUrl?: string;
    sellPrice?: number;
}

export interface LuckBag {
    id: string;
    name: string;
    totalParticipants: number;
    price: number;
    revealLottery?: boolean;
    imageUrl?: string;
    imageHint?: string;
    status?: LuckBagStatus;
    order?: number;
    currency?: 'diamond' | 'p-point';
    prizes?: {
        first?: string;
        second?: string;
        third?: string;
    };
    otherPrizes?: { cardId: string; prizeId: string; }[];
    winners?: {
      [key: string]: number;
    }
}

export interface LuckBagWithCount extends LuckBag {
    participantCount: number;
    prizeCards: {
        first?: CardData;
        second?: CardData;
        third?: CardData;
    };
    otherPrizesList: (CardData & { prizeId: string }) [];
}

const LuckBagCard = ({ bag, priority = false, index }: { bag: LuckBagWithCount, priority?: boolean, index: number }) => {
    const isDone = bag.status === '已開獎';
    const currency = bag.currency || 'p-point';
    const progress = (bag.participantCount / (bag.totalParticipants || 1)) * 100;

    return (
         <Link 
            href={`/lucky-bags/${bag.id}`}
            className={cn(
                "group relative flex flex-col md:flex-row p-3 md:p-5 bg-slate-200 border-b-[8px] border-r-[8px] border-slate-400 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-2 cursor-pointer overflow-hidden",
                "animate-fade-in-up"
            )}>
                
                {/* 左側：寬螢幕區塊 (顯示獎項) */}
                <div className="relative flex-[1.4] flex flex-col bg-slate-600 rounded-2xl p-3 md:p-4 shadow-inner border-b-4 border-white/10">
                    <div className="relative flex-1 flex bg-[#f0f4f7] rounded-lg overflow-hidden border-4 border-[#ccd6d9] items-center p-4">
                        <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,2px_100%]" />
                        
                        <div className={cn(
                            "relative w-24 md:w-32 aspect-[2.5/4] shrink-0 transition-all duration-700 rounded-sm overflow-hidden border border-black/5 shadow-md",
                            isDone && "opacity-40 grayscale-[50%]"
                        )}>
                            {bag.prizeCards.first && (
                                <SafeImage 
                                    src={bag.prizeCards.first.imageUrl} 
                                    alt={bag.prizeCards.first.name}
                                    fill
                                    className="object-contain"
                                    priority={priority}
                                    sizes="128px"
                                />
                            )}
                        </div>

                        <div className="ml-4 md:ml-8 flex-1 flex flex-col justify-center overflow-hidden">
                            <h3 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tighter line-clamp-2 leading-tight mb-2">
                                {bag.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={isDone ? "secondary" : bag.revealLottery ? "destructive" : "default"} className="font-black text-[9px] md:text-[10px] uppercase h-5 px-2 border-none">
                                    {isDone ? '已開獎' : bag.revealLottery ? '開獎中' : '募集進行中'}
                                </Badge>
                                {isDone && bag.winners?.first && (
                                    <span className="text-[10px] font-black text-primary italic uppercase tracking-widest">
                                        Jackpot: #{bag.winners.first}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右側：操作與狀態區塊 (控制面板) */}
                <div className="flex-1 flex flex-col justify-between p-3 md:p-6 text-slate-900">
                    <div className="space-y-5">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">每格參與價格</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl md:text-4xl font-black text-accent font-code leading-none">
                                        {(bag.price || 0).toLocaleString()}
                                    </p>
                                    {currency === 'diamond' ? <Gem className="w-5 h-5 md:w-6 md:h-6 text-primary" /> : <PPlusIcon className="w-5 h-5 md:w-6 md:h-6" />}
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">當前募集</p>
                                <p className="text-base md:text-xl font-black text-slate-900 font-code">{bag.participantCount} <span className="text-slate-400 font-normal">/ {bag.totalParticipants}</span></p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="w-full bg-slate-300 h-3 rounded-full overflow-hidden border-2 border-slate-400 shadow-inner">
                                <div className="h-full bg-slate-800 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)]" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[8px] font-black text-slate-400 uppercase text-right tracking-widest">Crowdfunding Progress</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mt-6">
                        {/* 模擬搖桿十字鍵 (橫向裝飾) */}
                        <div className="relative w-12 h-12 opacity-30 group-hover:opacity-60 transition-opacity">
                            <div className="absolute top-1/2 left-0 right-0 h-4 -translate-y-1/2 bg-slate-400 rounded-sm shadow-sm" />
                            <div className="absolute left-1/2 top-0 bottom-0 w-4 -translate-x-1/2 bg-slate-400 rounded-sm shadow-sm" />
                        </div>
                        
                        {/* 模擬按鈕 (功能提示) */}
                        <div className="flex gap-3 rotate-[-10deg] pr-2">
                            <div className="w-8 h-8 rounded-full bg-slate-300 border-b-4 border-slate-400" />
                            <div className="relative">
                                <div className="absolute inset-0 bg-accent rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity animate-pulse" />
                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-accent border-b-4 border-amber-700 shadow-lg flex items-center justify-center relative z-10">
                                    <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-amber-900 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
    );
}

export default function LuckyBagsPage() {
    const firestore = useFirestore();
    const [luckyBagsWithData, setLuckyBagsWithData] = useState<LuckBagWithCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAllCompleted, setShowAllCompleted] = useState(false);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const luckBagsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'luckBags'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: allLuckyBags, isLoading: isLoadingBags } = useCollection<LuckBag>(luckBagsQuery);
    
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(
        useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore])
    );

    const fetchExtraData = useCallback(async () => {
        if (!allLuckyBags || !firestore || !allCards) return;

        setIsLoading(true);
        try {
            const cardMap = new Map(allCards.map(c => [c.id, c]));

            const bagsWithData = await Promise.all(
                allLuckyBags.map(async (bag) => {
                    const purchasesColRef = collection(firestore, 'luckBags', bag.id, 'luckBagPurchases');
                    const countSnapshot = await getCountFromServer(query(purchasesColRef));
                    const participantCount = countSnapshot.data().count;

                    const prizeCards = {
                        first: bag.prizes?.first ? cardMap.get(bag.prizes.first) : undefined,
                        second: bag.prizes?.second ? cardMap.get(bag.prizes.second) : undefined,
                        third: bag.prizes?.third ? cardMap.get(bag.prizes.third) : undefined,
                    };
                    
                    const otherPrizesList = (bag.otherPrizes || [])
                        .map(p => {
                            const card = cardMap.get(p.cardId);
                            return card ? { ...card, prizeId: p.prizeId } : null;
                        })
                        .filter((c): c is CardData & { prizeId: string } => !!c);

                    return {
                        ...bag,
                        participantCount,
                        prizeCards,
                        otherPrizesList,
                    };
                })
            );
            setLuckyBagsWithData(bagsWithData);
        } catch (error) {
            console.error("Error fetching luck bag data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [allLuckyBags, allCards, firestore]);

    useEffect(() => {
        if (!isLoadingBags && !isLoadingCards && allLuckyBags) {
            fetchExtraData();
        }
    }, [allLuckyBags, allCards, firestore, isLoadingBags, isLoadingCards, fetchExtraData]);

    const { inProgressBags, completedBags } = useMemo(() => {
        const inProgress = luckyBagsWithData.filter(bag => bag.status !== '已開獎');
        const completed = luckyBagsWithData.filter(bag => bag.status === '已開獎');
        return { inProgressBags: inProgress, completedBags: completed };
    }, [luckyBagsWithData]);

    const finalIsLoading = isLoadingBags || isLoadingCards || isLoading;

    return (
      <div className="container py-12 md:py-20 relative overflow-hidden px-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-accent/5 blur-[120px] pointer-events-none" />

          {/* 右上角規則按鈕 */}
          <div className="absolute top-4 right-4 md:top-10 md:right-10 z-30">
              <Dialog>
                  <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto px-0 md:px-4 rounded-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-accent/10 hover:border-accent/30 text-white font-bold transition-all gap-2">
                          <Info className="h-4 w-4 text-accent" />
                          <span className="text-xs uppercase tracking-widest hidden md:inline">遊戲規則</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-accent/20 shadow-2xl">
                      <DialogHeader>
                          <DialogTitle className="text-2xl font-black font-headline text-accent italic tracking-tighter uppercase">LUCKY BAG RULES</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-5 text-sm text-white/80 leading-relaxed py-2">
                          <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                              <p className="flex items-start gap-4"><span className="text-accent font-black font-code text-lg">01.</span> 福袋採「募集制」，達到指定參與人數後即開獎。</p>
                              <p className="flex items-start gap-4"><span className="text-accent font-black font-code text-lg">02.</span> 每個位置的中獎機率均等，保證包含所列之大獎。</p>
                              <p className="flex items-start gap-4"><span className="text-accent font-black font-code text-lg">03.</span> 系統將隨機配對中獎號碼，獲獎卡片將直接發放至您的收藏庫。</p>
                              <p className="flex items-start gap-4"><span className="text-accent font-black font-code text-lg">04.</span> 使用紅利 P+ 點或鑽石參與，中獎價值通常高於參與成本。</p>
                          </div>
                      </div>
                  </DialogContent>
              </Dialog>
          </div>

          <div className="text-center mb-12 relative z-10 space-y-4">
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold tracking-[0.3em] uppercase animate-fade-in-up">
                    <Sparkles className="w-3 h-3" /> COLLECTIVE DESTINY
                </div>
            </div>
            
            <div className="flex items-center justify-center animate-fade-in-up">
                <h1 className="font-headline text-3xl sm:text-6xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                    福袋專區
                </h1>
            </div>
          </div>

          <div className="space-y-16 max-w-6xl mx-auto">
            <section>
                <div className="mb-8 flex items-center justify-between animate-fade-in-up">
                    <h2 className="flex items-center text-lg md:text-xl font-bold font-headline text-white tracking-widest uppercase">
                        <LuckyBagIcon className="w-5 h-5 md:w-6 md:h-6 mr-3 text-accent animate-bounce" />
                        正在募集
                    </h2>
                    <div className="h-px flex-1 mx-6 bg-gradient-to-r from-accent/30 to-transparent hidden sm:block" />
                </div>
                <div className="grid grid-cols-1 gap-8 md:gap-10">
                    {finalIsLoading ? (
                        Array.from({length: 2}).map((_, i) => (
                            <div key={i} className="aspect-[21/9] rounded-3xl overflow-hidden">
                                <Skeleton className="w-full h-full" />
                            </div>
                        ))
                    ) : (
                        inProgressBags.map((bag, index) => (
                            <LuckBagCard key={bag.id} bag={bag} priority={index < 3} index={index} />
                        ))
                    )}
                </div>
            </section>

            {completedBags.length > 0 && (
                <section className="opacity-80">
                    <div className="mb-8 flex items-center justify-between animate-fade-in-up">
                        <h2 className="flex items-center text-lg md:text-xl font-bold font-headline text-muted-foreground tracking-widest uppercase">
                            <Trophy className="w-5 h-5 md:w-6 md:h-6 mr-3" />
                            精彩回顧
                        </h2>
                        <div className="h-px flex-1 mx-6 bg-gradient-to-r from-white/10 to-transparent hidden sm:block" />
                    </div>
                    <div className="grid grid-cols-1 gap-8 md:gap-10">
                        {completedBags.slice(0, showAllCompleted ? undefined : 2).map((bag, index) => (
                            <LuckBagCard key={bag.id} bag={bag} index={index} />
                        ))}
                    </div>
                    
                    {!showAllCompleted && completedBags.length > 2 && (
                        <div className="mt-10 flex justify-center">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowAllCompleted(true)}
                                className="rounded-full px-10 h-12 border-white/10 hover:bg-white/5 font-bold"
                            >
                                <ChevronDown className="mr-2 h-4 w-4" /> 查看更多已結束福袋
                            </Button>
                        </div>
                    )}
                </section>
            )}
          </div>

          <div className="mt-20 text-center flex flex-col items-center opacity-20">
            <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Security Protocol • Verified Asset</p>
          </div>
      </div>
    );
}
