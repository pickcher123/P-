'use client';

import { BettingGameDialog } from '@/components/betting-game-dialog';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, runTransaction, increment, serverTimestamp, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { CrossedCardsIcon, PPlusIcon } from '@/components/icons';
import { Info, Sparkles, Gem, HelpCircle, Gift, ShoppingBag, Loader2, Truck, Check, Package, Settings, ChevronRight, Swords, Target, RefreshCw, ShieldCheck, XCircle, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { UserProfile } from '@/types/user-profile';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';

interface BettingCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    allCardIds: string[];
    soldCardIds: string[];
}

interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    isFeatured?: boolean;
    isSold?: boolean;
}

interface CategoryWithCount extends BettingCategory {
    itemCount: number;
}

export default function BetLandingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<'price-high' | 'price-low' | 'latest' | 'unsold'>('latest');

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const categoriesQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return query(collection(firestore, 'bettingCategories'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<BettingCategory>(categoriesQuery);

    const bettingItemsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]);
    const { data: allBettingItems } = useCollection<BettingItems>(bettingItemsCollectionRef);

    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards } = useCollection<CardData>(allCardsCollectionRef);

    const cardsInBetting = useMemo(() => {
        if (!allCards || !allBettingItems) return [];
        const cardIdsInBetting = new Set<string>();
        allBettingItems.forEach(item => {
            item.allCardIds?.forEach(id => cardIdsInBetting.add(id));
        });
        
        let baseCards = allCards.filter(card => cardIdsInBetting.has(card.id));
        
        // Search
        if (searchTerm.trim()) {
            baseCards = baseCards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // Sorting
        const soldCardIds = new Set<string>();
        allBettingItems.forEach(item => {
            item.soldCardIds?.forEach(id => soldCardIds.add(id));
        });

        return baseCards.sort((a, b) => {
            if (sortOption === 'price-high') return (b.sellPrice || 0) - (a.sellPrice || 0);
            if (sortOption === 'price-low') return (a.sellPrice || 0) - (b.sellPrice || 0);
            if (sortOption === 'unsold') {
                const aSold = soldCardIds.has(a.id) || a.isSold;
                const bSold = soldCardIds.has(b.id) || b.isSold;
                if (aSold === bSold) return 0;
                return aSold ? 1 : -1;
            }
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0); // Default latest (featured first)
        });
    }, [allCards, allBettingItems, searchTerm, sortOption]);

    useEffect(() => {
        const fetchItemCounts = async () => {
            if (!categories || !firestore) return;

            setIsLoading(true);
            try {
                const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const counts = await Promise.all(
                    sortedCategories.map(async (category) => {
                        const itemDocRef = doc(firestore, 'betting-items', category.id);
                        const itemDocSnap = await getDoc(itemDocRef);
                        let count = 0;
                        if(itemDocSnap.exists()){
                            const data = itemDocSnap.data() as BettingItems;
                            const availableCount = (data.allCardIds?.length || 0) - (data.soldCardIds?.length || 0);
                            count = availableCount;
                        }
                        return {
                            ...category,
                            itemCount: count
                        };
                    })
                );
                setCategoriesWithCounts(counts);
            } catch (error) {
                console.error("Error fetching item counts: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isLoadingCategories && categories) {
            fetchItemCounts();
        }
    }, [categories, firestore, isLoadingCategories]);

    const finalIsLoading = isLoadingCategories || isLoading;

    if (!finalIsLoading && systemConfig?.featureFlags?.isBettingEnabled === false) {
        return (
            <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
                <div className="p-10 rounded-full bg-destructive/10 border border-destructive/20 animate-pulse shadow-[0_0_50px_rgba(219,39,119,0.2)]">
                    <Settings className="w-20 h-20 text-destructive" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">專區維護中</h2>
                    <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                        拼卡專區目前正在進行機率演算法優化與系統升級，為了確保公平性，暫時停止服務。
                    </p>
                </div>
                <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-destructive/30 hover:bg-destructive/5 font-bold transition-all">
                    <Link href="/">返回榮耀大廳</Link>
                </Button>
            </div>
        )
    }

    const cardOpacity = systemConfig?.cardOpacity ?? 0.85;

    return (
        <div className="container py-8 md:py-16 relative overflow-hidden px-4 md:px-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-destructive/5 blur-[120px] pointer-events-none" />

            <div className="text-center mb-6 md:mb-8 relative z-10 space-y-4">
                <div className="flex justify-center mb-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase animate-fade-in-up">
                        <Swords className="w-3 h-3 md:w-3.5 md:h-3.5 text-accent animate-pulse" /> ONE SPIN, ONE DESTINY
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center animate-fade-in-up">
                    <h1 className="font-headline text-3xl sm:text-6xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(219,39,119,0.4)]">
                        拚卡專區
                    </h1>
                </div>
            </div>

            {/* 直觀遊戲規則區塊 - 科技感強化版 */}
            <div className="max-w-6xl mx-auto mb-12 md:mb-16 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    {[
                        { title: '1/10 命中率', desc: '每注固定 10% 機率直接帶走卡片', icon: Target, color: 'text-cyan-400', border: 'border-cyan-500/30' },
                        { title: '雙幣別支付', desc: '支援使用鑽石或紅利 P+ 參與', icon: RefreshCw, color: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
                        { title: '1:10 價值比', desc: '鑽石與 P+ 點比例固定 1:10', icon: Gem, color: 'text-amber-400', border: 'border-amber-500/30' },
                        { title: '資產即時發放', desc: '中獎後卡片立即存入數位收藏庫', icon: ShieldCheck, color: 'text-emerald-400', border: 'border-emerald-500/30' },
                    ].map((item, idx) => (
                        <div key={idx} className={cn("relative p-4 md:p-6 rounded-xl bg-slate-950/60 backdrop-blur-md border flex flex-col items-center text-center group hover:bg-slate-900/80 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]", item.border)}>
                            <div className={cn("absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2", item.color)} />
                            <div className={cn("absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2", item.color)} />
                            <div className={cn("mb-4 p-3 rounded-full bg-slate-900 border border-white/5", item.color)}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-white mb-2 tracking-[0.1em] font-mono uppercase">{item.title}</h4>
                            <p className="text-[10px] md:text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6 md:mb-10 flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <h2 className="flex items-center text-base md:text-xl font-bold font-headline text-white tracking-widest uppercase">
                    <CrossedCardsIcon className="w-4 h-4 md:w-6 md:h-6 mr-3 text-destructive animate-pulse" />
                    選擇主題
                </h2>
                <div className="h-px flex-1 mx-4 md:mx-6 bg-gradient-to-r from-destructive/30 to-transparent hidden md:block" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto mb-20">
                 {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                    <div key={i} className="aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden">
                        <Skeleton className="w-full h-full" />
                    </div>
                ))}
                {!finalIsLoading && categoriesWithCounts.map((category, index) => (
                    <Link 
                        href={`/bet/${encodeURIComponent(category.id)}`} 
                        key={category.id} 
                        className={cn(
                            "group relative aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden block border border-white/10 transition-all duration-500",
                            "hover:border-destructive/50 hover:shadow-[0_0_50px_rgba(219,39,119,0.3)] hover:-translate-y-2",
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent group-hover:via-destructive/5 transition-all duration-500" />
                        
                        <div className="absolute top-3 right-3 md:top-6 md:right-6 flex gap-1 md:gap-2 opacity-10 group-hover:opacity-30 transition-opacity">
                            <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-destructive" />
                            <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-slate-800" />
                        </div>

                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-12 text-center">
                            <div className="transform transition-transform duration-500 group-hover:translate-y-[-5px] w-full px-2">
                                <h3 className="font-headline text-lg lg:text-3xl xl:text-5xl font-black text-white tracking-tighter drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)] group-hover:text-destructive transition-colors truncate">
                                    {category.name}
                                </h3>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* 全部卡片展示區 - 優化版 */}
            <div className="mb-8 flex flex-col md:flex-row items-center justify-between animate-fade-in-up px-4 md:px-8 gap-4">
                <h2 className="flex items-center text-sm md:text-lg font-bold font-headline text-white tracking-widest uppercase">
                    全部卡片
                    <Package className="w-3 h-3 md:w-5 md:h-5 ml-3 text-primary animate-pulse" />
                </h2>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 flex-1 md:flex-none">
                         <span className="text-xs text-white/50 whitespace-nowrap">排序:</span>
                         <Select 
                            value={sortOption} 
                            onValueChange={(val) => setSortOption(val as any)}
                        >
                            <SelectTrigger className="h-8 bg-card/50 border-destructive/30 rounded-lg font-bold text-white text-xs w-[120px]">
                                <SelectValue placeholder="排序方式" />
                            </SelectTrigger>
                            <SelectContent className="bg-card/95 rounded-xl">
                                <SelectItem value="latest" className="font-bold py-2 cursor-pointer">最新</SelectItem>
                                <SelectItem value="price-high" className="font-bold py-2 cursor-pointer">價格高至低</SelectItem>
                                <SelectItem value="price-low" className="font-bold py-2 cursor-pointer">價格低至高</SelectItem>
                                <SelectItem value="unsold" className="font-bold py-2 cursor-pointer">尚未售出</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="搜尋獎品名稱..." 
                            className="pl-9 h-8 bg-background/40 rounded-lg border-white/10 text-xs" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-7xl mx-auto">
                {!allBettingItems && Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="aspect-[2.5/4] rounded-[1.5rem]" />)}
                {cardsInBetting?.map((card) => {
                    const isSold = card.isSold;
                    return (
                        <BettingGameDialog key={card.id} card={{...card, category: 'all'}} categoryName={encodeURIComponent('all')} disabled={isSold}>
                            <div className={cn(
                                "relative aspect-[2.5/4] rounded-[1.5rem] overflow-hidden border border-white/10 bg-slate-900 cursor-pointer hover:border-primary transition-all group",
                                isSold && "grayscale opacity-40 cursor-not-allowed"
                            )}>
                                <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 16vw" />
                                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-[9px] font-black tracking-widest text-primary px-2 py-0.5 rounded-lg border border-primary/20 pointer-events-none z-20">
                                    {card.sellPrice ? `${card.sellPrice}💎` : 'N/A'}
                                </div>
                                {isSold && (
                                    <div className="absolute inset-0 flex items-center justify-center p-2 z-10">
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                                        <div className="relative flex flex-col items-center gap-1">
                                            <XCircle className="w-6 h-6 text-destructive" />
                                            <span className="text-[10px] font-black text-white bg-destructive px-2 py-0.5 rounded rotate-[-12deg] shadow-lg">已被抽出</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </BettingGameDialog>
                    );
                })}
            </div>

            <div className="mt-20 text-center flex flex-col items-center opacity-20">
                <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Security Protocol • Verified Asset</p>
            </div>
        </div>
    )
}
