'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { Button } from '@/components/ui/button';
import { Layers, Gem, Package, Disc3, Info, Sparkles, ChevronRight, Star, Trophy, Clock, Settings } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { PoolCard } from '@/components/pool-card';
import type { SystemConfig } from '@/types/system';
import { HallOfFameMarquee } from '@/components/hall-of-fame-marquee';

interface DrawCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
    linkUrl?: string; // Add linkUrl
}

interface CardPool {
    id: string;
    name: string;
    description: string;
    price?: number;
    price3Draws?: number;
    totalPacks?: number;
    remainingPacks?: number;
    hasProtection?: boolean;
    isFeatured?: boolean;
    isActive?: boolean;
    currency?: 'diamond' | 'p-point';
    cardRarities?: { [cardId: string]: any };
    cards?: { cardId: string; quantity: number }[];
    pointPrizes?: any[];
    lastPrizeCardId?: string;
    imageUrl?: string;
    startsAt?: { seconds: number; nanoseconds: number; };
    expiresAt?: { seconds: number; nanoseconds: number; };
    lockedBy?: string;
    lockedAt?: { seconds: number; nanoseconds: number; };
    categoryId?: string;
}

interface CategoryWithCount extends DrawCategory {
    poolCount: number;
}

export default function DrawPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { data: userProfile } = useDoc<any>(useMemoFirebase(() => (user?.uid ? doc(firestore, 'users', user.uid) : null), [user?.uid, firestore]));
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'drawCategories'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection<DrawCategory>(categoriesQuery);
  const { data: cardPools, isLoading: isLoadingPools } = useCollection<CardPool>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  
  // 修正：確保包含 isSold 狀態
  const { data: allCards } = useCollection<{id: string, name: string, imageUrl: string, isSold?: boolean}>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));

  const allCardsMap = useMemo(() => {
    if (!allCards) return new Map();
    return new Map(allCards.map(c => [c.id, c as any]));
  }, [allCards]);

  useEffect(() => {
      if (categories && cardPools) {
          const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          
          // Add custom category "球卡一番賞"
          sortedCategories.push({
              id: 'ifansan-prize',
              name: '球卡一番賞',
              imageUrl: 'https://i.ibb.co/ynNvhHmN/P-carder.jpg', // Provide a default image URL
              order: 99,
              linkUrl: 'https://ifansan.com/?0000V'
          } as any);

          const counts = sortedCategories.map(category => {
              const count = cardPools.filter(pool => pool.categoryId === category.id).length;
              return { ...category, poolCount: count };
          });
          setCategoriesWithCounts(counts);
          setIsLoading(false);
      }
  }, [categories, cardPools]);

  const [sortOption, setSortOption] = useState<'price-high' | 'price-low' | 'latest'>('latest');

  const allPools = useMemo(() => {
    if (!cardPools || cardPools.length === 0) return [];
    const now = Math.floor(Date.now() / 1000);
    const pools = cardPools.filter(p => 
        (p.remainingPacks ?? 0) > 0 && 
        (!p.expiresAt || p.expiresAt.seconds > now) &&
        (!p.startsAt || p.startsAt.seconds < now) &&
        (p.isActive !== false)
    );
    
    // Explicit sorting logic based on sortOption
    return pools.sort((a, b) => {
        if (sortOption === 'price-high') return (b.price ?? 0) - (a.price ?? 0);
        if (sortOption === 'price-low') return (a.price ?? 0) - (b.price ?? 0);
        return 0; // Default or latest
    });
  }, [cardPools, sortOption]);

  const finalIsLoading = isLoadingCategories || isLoadingPools || isLoading;

  if (!finalIsLoading && systemConfig?.featureFlags?.isDrawEnabled === false) {
    return (
        <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
            <div className="p-10 rounded-full bg-primary/10 border border-primary/20 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                <Settings className="w-20 h-20 text-primary" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">專區維護中</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                    為了提供更流暢的開獎體驗，抽卡專區正在進行伺服器優化與系統升級，請稍後再試。
                </p>
            </div>
            <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-primary/30 hover:bg-primary/5 font-bold transition-all">
                <Link href="/">返回榮耀大廳</Link>
            </Button>
        </div>
    )
  }

  const cardOpacity = systemConfig?.cardOpacity ?? 0.85;

  return (
    <div className="container py-6 md:py-10 relative overflow-hidden px-4 md:px-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-amber-500/5 blur-[120px] pointer-events-none" />
        
        {/* 右上角規則按鈕 */}
        <div className="absolute top-4 right-4 md:top-8 md:right-10 z-30">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto px-0 md:px-4 rounded-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-amber-500/10 hover:border-amber-500/30 text-white font-bold transition-all gap-2">
                        <Info className="h-4 w-4 text-amber-400" />
                        <span className="text-xs uppercase tracking-widest hidden md:inline">遊戲規則</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] bg-slate-950 backdrop-blur-2xl border-amber-500/20 shadow-[0_0_50px_rgba(251,191,36,0.15)]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black font-headline text-amber-400 italic tracking-tighter uppercase">RULES OF ENGAGEMENT</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 text-sm text-white/80 leading-relaxed py-2">
                        <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                            <p className="flex items-start gap-4">
                                <span className="text-amber-400 font-black font-code text-lg shrink-0">01.</span>
                                <span>玩家消耗點數從卡池中抽取獎品。</span>
                            </p>
                            <p className="flex items-start gap-4">
                                <span className="text-amber-400 font-black font-code text-lg shrink-0">02.</span>
                                <span>每個卡池包含一組特定的卡片和點數獎項，每個獎項都有不同的稀有度。</span>
                            </p>
                            <p className="flex items-start gap-4">
                                <span className="text-amber-400 font-black font-code text-lg shrink-0">03.</span>
                                <span>每個稀有度的中獎機率都會在卡池資訊中明確列出。</span>
                            </p>
                            <p className="flex items-start gap-4">
                                <span className="text-amber-400 font-black font-code text-lg shrink-0">04.</span>
                                <span>抽出的卡片會自動加入您的「收藏庫」。</span>
                            </p>
                            <p className="flex items-start gap-4">
                                <span className="text-amber-400 font-black font-code text-lg shrink-0">05.</span>
                                <span className="flex flex-wrap items-center">
                                    <span className="text-accent font-bold underline underline-offset-4 mr-1">保護機制</span>：具備 120s 鎖定期，保障開獎流暢度。
                                </span>
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>

        <div className="text-center mb-2 md:mb-1 relative z-10 space-y-1">
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] md:text-[10px] font-bold tracking-[0.2em] uppercase animate-fade-in-up shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                    <Sparkles className="w-2.5 h-2.5" /> SELECT YOUR DESTINY
                </div>
            </div>
        </div>

        {/* 傳奇大獎牆區塊 */}
        <div className="mb-1 md:mb-2">
            <HallOfFameMarquee />
        </div>
        
        <div className="mb-3 md:mb-4 flex items-center justify-between animate-fade-in-up px-4 md:px-8">
            <h2 className="flex items-center text-sm md:text-lg font-bold font-headline text-white tracking-widest text-left">
                <span className="flex items-center"><Disc3 className="w-4 h-4 md:w-5 md:h-5 mr-3 text-amber-400 animate-spin-slow shrink-0" />選擇主題</span>
            </h2>
            <div className="h-px flex-1 mx-4 md:mx-6 bg-gradient-to-r from-amber-500/30 to-transparent hidden sm:block" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 max-w-7xl mx-auto">
             {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                <div key={i} className="aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden">
                    <Skeleton className="w-full h-full" />
                </div>
            ))}
            {!finalIsLoading && categoriesWithCounts.map((category, index) => (
                <Link 
                    href={category.linkUrl || `/draw/${encodeURIComponent(category.id)}`} 
                    target={category.linkUrl ? "_blank" : undefined}
                    key={category.id} 
                    className={cn(
                        "group relative aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden block border border-white/10 transition-all duration-500",
                        "hover:border-primary/50 hover:shadow-[0_0_50px_rgba(6,182,212,0.3)] hover:-translate-y-2",
                        "animate-fade-in-up"
                    )}
                    style={{ backgroundColor: `hsl(var(--card) / ${cardOpacity})` }}
                >
                    <SafeImage
                        src={category.imageUrl}
                        alt={category.name}
                        fill
                        className="object-cover transition-all duration-1000 group-hover:scale-110 opacity-60 grayscale-[30%] group-hover:grayscale-0"
                        priority={index < 4}
                        sizes="(max-width: 768px) 50vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent group-hover:via-primary/5 transition-all duration-500" />
                    
                    <div className="absolute top-3 right-3 md:top-6 md:right-6 flex gap-1 md:gap-2 opacity-10 group-hover:opacity-30 transition-opacity">
                        <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-white" />
                        <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-white" />
                    </div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-12 text-center">
                        <div className="transform transition-transform duration-500 group-hover:translate-y-[-5px] w-full px-2">
                            <h3 className="font-headline text-base lg:text-2xl xl:text-4xl font-black text-white tracking-tighter drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)] group-hover:text-primary transition-colors">
                                {category.id === 'ifansan-prize' ? (
                                    <>
                                        球卡一番賞
                                        <span className="block text-xs lg:text-base xl:text-lg font-medium mt-1">
                                            (500元/抽 以下)
                                        </span>
                                    </>
                                ) : (
                                    <span className="truncate block">{category.name}</span>
                                )}
                            </h3>
                        </div>
                    </div>
                </Link>
            ))}
        </div>

        {!finalIsLoading && allPools.length > 0 && (
            <div className="space-y-6 md:space-y-8 animate-fade-in-up">
                <div className="flex items-center justify-between">
                    <h2 className="flex items-center text-base md:text-lg font-bold font-headline text-accent tracking-widest text-left">
                        <Trophy className="w-5 h-5 md:w-6 md:h-6 mr-3 text-accent animate-bounce shrink-0" />
                        全部卡池
                    </h2>
                    <div className="flex items-center gap-2">
                         <span className="text-xs text-white/50">排序:</span>
                         <select 
                            className="bg-card text-xs p-1 rounded border border-white/10"
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                         >
                             <option value="latest">最新</option>
                             <option value="price-high">價格高至低</option>
                             <option value="price-low">價格低至高</option>
                         </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {allPools.map((pool) => (
                        <div key={pool.id} className="relative">
                            {pool.isFeatured && (
                                <div className="absolute -top-2 -left-2 z-20 rotate-[-15deg]">
                                    <div className="bg-accent text-accent-foreground font-black text-[10px] px-3 py-1 rounded-full shadow-lg border border-white/20 uppercase tracking-widest">
                                        精選
                                    </div>
                                </div>
                            )}
                            <PoolCard pool={pool} allCardsMap={allCardsMap} userProfile={userProfile} />
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="mt-12 text-center flex flex-col items-center opacity-20">
            <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Terminal • Link Stable • Secure Protocol</p>
        </div>
    </div>
  );
}
