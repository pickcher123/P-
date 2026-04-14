'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { collection, query, where, Timestamp, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Layers, Gem, Sparkles, Clock, ShieldCheck, Diamond, Star, X, Ban, AlertCircle, Archive } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { CardItem } from '@/components/card-item';
import { userLevels } from '@/components/member-level-crown';

const RARITIES = ['legendary', 'rare', 'common'] as const;
type Rarity = typeof RARITIES[number];

const rarityStyles: Record<Rarity, { text: string, bg: string, border: string, shadow: string, label: string, icon: any }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/40', shadow: 'shadow-accent/20', label: 'LEGENDARY', icon: Star },
  rare: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/40', shadow: 'shadow-primary/20', label: 'RARE', icon: Diamond },
  common: { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/20', shadow: 'shadow-white/5', label: 'COMMON', icon: Layers },
};

const pointPrizeStyles: Record<Rarity, { text: string, bg: string, border: string }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  rare: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  common: { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' },
};

interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    isSold?: boolean;
}

interface PointPrize {
    prizeId: string;
    points: number;
    quantity: number;
    rarity: Rarity;
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
  currency?: 'diamond' | 'p-point';
  cardRarities?: { [cardId: string]: Rarity };
  cards?: { cardId: string; quantity: number }[];
  pointPrizes?: PointPrize[];
  lastPrizeCardId?: string;
  imageUrl?: string;
  startsAt?: { seconds: number; nanoseconds: number; };
  expiresAt?: { seconds: number; nanoseconds: number; };
  lockedBy?: string;
  lockedAt?: { seconds: number; nanoseconds: number; };
  categoryId?: string;
  dailyLimit?: number;
  minLevel?: string;
}

const LOCK_DURATION = 120;

export function PoolCard({ pool, allCardsMap, userProfile }: { pool: CardPool, allCardsMap: Map<string, CardData>, userProfile: any }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [previewCard, setPreviewCard] = useState<any | null>(null);

    const isAuthReady = !isUserLoading;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const poolStatsRef = useMemoFirebase(() => 
        (firestore && user?.uid && pool.id) ? doc(firestore, 'users', user.uid, 'poolStats', pool.id) : null, 
        [firestore, user?.uid, pool.id]
    );
    const { data: poolStats, isLoading: isLoadingStats, error: statsError } = useDoc<any>(poolStatsRef);

    useEffect(() => {
        if (statsError) {
            console.error('Firestore Error (poolStats):', statsError);
        }
    }, [statsError]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const todayDrawCount = useMemo(() => {
        if (!poolStats || poolStats.lastDrawDate !== todayStr) return 0;
        return poolStats.count || 0;
    }, [poolStats, todayStr]);

    const isDailyLimitReached = useMemo(() => {
        return !!(pool.dailyLimit && pool.dailyLimit > 0 && todayDrawCount >= pool.dailyLimit);
    }, [pool.dailyLimit, todayDrawCount]);

    const poolStatus = useMemo(() => {
        const isSoldOut = (pool.remainingPacks ?? 0) <= 0;
        if (isSoldOut) return { status: 'sold-out', disabled: true, message: '已全數售罄' };
        if (pool.expiresAt && currentTime > new Date(pool.expiresAt.seconds * 1000)) return { status: 'expired', disabled: true, message: '已結束' };
        if (pool.startsAt) {
            const start = new Date(pool.startsAt.seconds * 1000);
            if (currentTime < start) return { status: 'not-started', disabled: true, message: format(start, "MM-dd HH:mm") + ' 開放' };
        }
        if (pool.hasProtection !== false && pool.lockedAt) {
            const lockTime = new Date(pool.lockedAt.seconds * 1000);
            const diff = Math.floor((currentTime.getTime() - lockTime.getTime()) / 1000);
            if (diff < LOCK_DURATION) {
                return { 
                    status: pool.lockedBy === user?.uid ? 'locked-by-me' : 'locked', 
                    disabled: pool.lockedBy !== user?.uid, 
                    message: `${LOCK_DURATION - diff}秒`, 
                    remaining: LOCK_DURATION - diff 
                };
            }
        }
        
        if (!isAuthReady || isLoadingStats) return { status: 'loading', disabled: true, message: '驗證中...' };
        
        const userLevelInfo = userLevels.find(l => l.level === userProfile?.userLevel) || userLevels[0];
        const minLevelInfo = userLevels.find(l => l.level === pool.minLevel);
        
        if (pool.minLevel && pool.minLevel !== '新手收藏家' && userLevelInfo && minLevelInfo && userLevelInfo.threshold < minLevelInfo.threshold) {
             return { status: 'level-too-low', disabled: true, message: `需等級 ${pool.minLevel} 以上` };
        }

        if (isDailyLimitReached) return { status: 'limit-reached', disabled: true, message: '今日次數已用完' };

        return { status: 'open', disabled: false, message: '' };
    }, [pool, currentTime, user, isDailyLimitReached, isLoadingStats, isAuthReady, userProfile]);
    
    const rarityProbabilities = useMemo(() => {
        if ((pool.remainingPacks ?? 0) <= 0) return { legendary: 0, rare: 0, common: 0 };

        const counts = { legendary: 0, rare: 0, common: 0 };
        let total = 0;
        
        pool.cards?.forEach(c => { 
            const r = pool.cardRarities?.[c.cardId]; 
            const cardData = allCardsMap.get(c.cardId);
            if (r && c.quantity > 0 && cardData && !cardData.isSold) { 
                counts[r] += c.quantity; 
                total += c.quantity; 
            } 
        });
        
        pool.pointPrizes?.forEach(p => { 
            if (p.rarity && p.quantity > 0) { 
                counts[p.rarity] += p.quantity; 
                total += p.quantity; 
            } 
        });

        if (total === 0) return { legendary: 0, rare: 0, common: 0 };
        return { 
            legendary: (counts.legendary / total) * 100, 
            rare: (counts.rare / total) * 100, 
            common: (counts.common / total) * 100 
        };
    }, [pool, allCardsMap]);

    const allPrizesInPool = useMemo(() => {
        const prizes: any[] = [];
        pool.cards?.forEach(c => {
            const data = allCardsMap.get(c.cardId);
            if (data) {
                prizes.push({
                    ...data,
                    quantity: c.quantity,
                    rarity: pool.cardRarities?.[c.cardId] || 'common',
                    isSoldOut: c.quantity <= 0 || data.isSold
                });
            }
        });
        pool.pointPrizes?.forEach(p => {
            prizes.push({
                id: p.prizeId,
                name: `${p.points} P+`,
                imageUrl: '',
                isPoints: true,
                points: p.points,
                quantity: p.quantity,
                rarity: p.rarity,
                isSoldOut: p.quantity <= 0
            });
        });
        return prizes;
    }, [pool, allCardsMap]);

    const lastPrizeCard = pool.lastPrizeCardId ? allCardsMap.get(pool.lastPrizeCardId) : null;
    
    const topPrizesPreview = useMemo(() => {
        const result: any[] = [];
        const addedCardIds = new Set<string>();
        
        for (const rarity of RARITIES) {
            if (result.length >= 4) break;

            if (pool.cardRarities) {
                Object.entries(pool.cardRarities)
                    .filter(([, r]) => r === rarity)
                    .forEach(([id]) => {
                        if (result.length >= 4) return;
                        const data = allCardsMap.get(id);
                        const qty = pool.cards?.filter(c => c.cardId === id).reduce((acc, c) => acc + (c.quantity || 0), 0) || 0;
                        
                        if (data && qty > 0 && !data.isSold && !addedCardIds.has(id)) { 
                            result.push({ ...data, type: 'card', rarity }); 
                            addedCardIds.add(id); 
                        }
                    });
            }

            if (pool.pointPrizes) {
                pool.pointPrizes
                    .filter(p => p.rarity === rarity && p.quantity > 0)
                    .forEach(p => {
                        if (result.length >= 4) return;
                        result.push({ 
                            id: p.prizeId, 
                            name: `${p.points} P+`, 
                            isPoints: true, 
                            points: p.points, 
                            rarity: p.rarity,
                            type: 'points' 
                        });
                    });
            }
        }
        return result;
    }, [pool, allCardsMap]);

    const canDraw3 = !isLoadingStats && (!pool.dailyLimit || pool.dailyLimit === 0 || (todayDrawCount + 3 <= pool.dailyLimit));

    return (
        <Dialog>
            <div className="relative flex flex-col p-2 bg-slate-900 border-[8px] border-slate-950 rounded-[2.5rem] shadow-2xl group transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(251,191,36,0.3)] [perspective:1000px]">
                <div className="relative flex flex-col bg-black/90 rounded-[1.5rem] border-[10px] border-slate-950 overflow-hidden transition-transform duration-500 group-hover:[transform:rotateY(5deg)_rotateX(5deg)]">
                    <div className="relative z-10 flex flex-col p-4 md:p-6 bg-slate-950/40">
                        <div className="text-center mb-4 space-y-2">
                            <h3 className="text-lg font-headline font-black text-white uppercase truncate">{pool.name}</h3>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20">{pool.description}</Badge>
                        </div>
                        <div className="bg-black/60 border border-white/10 p-3 rounded-2xl mb-4">
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-[9px] font-black text-primary uppercase">即時存量</span>
                                <div className="font-code text-xl font-black text-white">{pool.remainingPacks} <span className="text-[10px] text-white/30">/ {pool.totalPacks}</span></div>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(6,182,212,0.6)]" style={{ width: `${(pool.remainingPacks || 0) / (pool.totalPacks || 1) * 100}%` }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {RARITIES.map(r => (
                                <div key={r} className={cn("p-2 rounded-2xl border flex flex-col items-center", rarityStyles[r].bg, rarityStyles[r].border)}>
                                    <span className={cn("text-[7px] font-black uppercase", rarityStyles[r].text)}>{rarityStyles[r].label}</span>
                                    <span className="text-xs font-black font-code text-white">{rarityProbabilities[r].toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                        <DialogTrigger asChild>
                            <div className="flex-1 bg-slate-900/60 border-2 border-primary/30 rounded-2xl p-4 cursor-pointer flex flex-col shadow-2xl min-h-[140px] transition-transform hover:scale-[1.02]">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-primary uppercase flex items-center gap-2"><Trophy className="w-4 h-4" /> 剩餘大獎</span>
                                    {lastPrizeCard && <Badge className="bg-accent text-accent-foreground text-[8px] font-black border-none animate-pulse">最後賞</Badge>}
                                </div>
                                <div className="grid grid-cols-4 gap-2 flex-1 items-center">
                                    {topPrizesPreview.map(item => (
                                        <div key={item.id} className="aspect-[2.5/4] relative rounded-lg overflow-hidden border border-white/5 bg-slate-950">
                                            {item.isPoints ? (
                                                <div className={cn("w-full h-full flex flex-col items-center justify-center p-1", pointPrizeStyles[item.rarity as Rarity].bg)}>
                                                    <PPlusIcon className={cn("w-6 h-6 mb-1", pointPrizeStyles[item.rarity as Rarity].text)} />
                                                    <p className="text-[8px] font-black text-white leading-none">{item.points}</p>
                                                </div>
                                            ) : (
                                                <SafeImage src={item.imageUrl} alt={item.name} sizes="80px" fill className="object-contain" />
                                            )}
                                        </div>
                                    ))}
                                    {topPrizesPreview.length === 0 && (
                                        <div className="col-span-4 py-4 text-center opacity-20 flex flex-col items-center">
                                            <Archive className="w-6 h-6 mb-1" />
                                            <span className="text-[8px] font-black uppercase">庫存中斷</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </DialogTrigger>
                    </div>
                    {poolStatus.status === 'sold-out' && (
                        <div className="absolute inset-0 z-50 bg-rose-950/40 backdrop-blur-[1px] flex items-center justify-center p-6">
                            <div className="bg-rose-600 text-white px-8 py-4 rounded-xl font-black text-2xl rotate-[-12deg] shadow-2xl">已售罄</div>
                        </div>
                    )}
                </div>
                <div className="mt-2 p-2 space-y-3">
                    <div className="flex items-center justify-between gap-1 px-1 mb-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                            {pool.minLevel && pool.minLevel !== '新手收藏家' && (
                                <Badge variant="outline" className="bg-primary/10 border-primary/30 text-white text-[8px] font-black h-5 px-2 flex items-center gap-1.5 uppercase shrink-0">
                                    <ShieldCheck className="w-2.5 h-2.5 text-primary" /> 等級: {pool.minLevel}
                                </Badge>
                            )}
                            {pool.dailyLimit && pool.dailyLimit > 0 && (
                                <Badge variant="outline" className={cn(
                                    "text-white text-[10px] font-black h-6 px-3 flex items-center gap-1.5 uppercase shrink-0 transition-all duration-500",
                                    isDailyLimitReached 
                                        ? "bg-rose-600 border-rose-400" 
                                        : "bg-amber-500/20 border-amber-500/50"
                                )}>
                                    <Ban className={cn("w-3 h-3", isDailyLimitReached ? "text-white" : "text-amber-500")} /> 
                                    今日限額: {pool.dailyLimit} 包
                                </Badge>
                            )}
                        </div>
                        <Badge variant="secondary" className="bg-black/60 border-white/10 text-primary text-[8px] font-code font-black h-5 px-1.5 flex items-center gap-1 shrink-0">
                            <Clock className="w-2.5 h-2.5" />下架: {pool.expiresAt ? format(new Date(pool.expiresAt.seconds * 1000), "MM-dd HH:mm") : '--'}
                        </Badge>
                        {(poolStatus.status === 'locked-by-me' || poolStatus.status === 'locked') && (
                            <Badge variant="secondary" className="bg-amber-500/20 border-amber-500/50 text-amber-500 text-[8px] font-code font-black h-5 px-1.5 flex items-center gap-1 shrink-0">
                                <ShieldCheck className="w-2.5 h-2.5" /> 保護: {poolStatus.message}
                            </Badge>
                        )}
                    </div>
                    
                    {poolStatus.disabled ? (
                        <Button 
                            disabled 
                            className="w-full h-[108px] text-xl font-black rounded-2xl bg-slate-800 text-slate-500 border-slate-700 border-b-4 opacity-50 italic"
                        >
                            {poolStatus.message || '無法抽卡'}
                        </Button>
                    ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                            <Button 
                                variant="outline" 
                                className="w-full h-11 text-sm font-black rounded-2xl transition-all bg-white/5 border-white/10 border-b-4 border-slate-950 active:translate-y-1 active:border-b-0" 
                                onClick={() => {
                                    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                                        window.navigator.vibrate(50);
                                    }
                                    router.push(`/draw/open?poolId=${pool.id}&draws=1`);
                                }}
                            >
                                <span className="flex-1 text-center italic">
                                    {`單抽 ${pool.price?.toLocaleString()}`}
                                </span>
                                {pool.currency === 'p-point' ? <PPlusIcon className="w-4 h-4 ml-2" /> : (
                                    <div className="relative flex items-center justify-center w-6 h-6 ml-2 rounded-full bg-primary/20 border border-primary/50">
                                        <Gem className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                )}
                            </Button>
                            <Button 
                                className={cn(
                                    "w-full h-14 text-xl font-black rounded-2xl transition-all active:translate-y-1 active:border-b-0",
                                    !canDraw3 ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50" : "bg-primary text-primary-foreground border-b-[6px] border-slate-950"
                                )} 
                                disabled={!canDraw3} 
                                onClick={() => {
                                    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                                        window.navigator.vibrate([50, 50, 50]);
                                    }
                                    router.push(`/draw/open?poolId=${pool.id}&draws=${Math.min(3, pool.remainingPacks || 0)}`);
                                }}
                            >
                                <span className="flex-1 text-center italic">
                                    {!canDraw3 ? '今日額度不足三抽' : `${Math.min(3, pool.remainingPacks || 0)}連抽 ${((Math.min(3, pool.remainingPacks || 0) === 3 ? pool.price3Draws : (pool.price || 0) * (Math.min(3, pool.remainingPacks || 0))) || 0).toLocaleString()}`}
                                </span>
                                {canDraw3 && (pool.currency === 'p-point' ? <PPlusIcon className="w-6 h-6 ml-2" /> : (
                                    <div className="relative flex items-center justify-center w-8 h-8 ml-2 rounded-full bg-white/20 border border-white/30">
                                        <Gem className="w-5 h-5 text-primary" />
                                    </div>
                                ))}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <DialogContent className="max-w-4xl bg-slate-950 backdrop-blur-3xl border-slate-800 rounded-[2.5rem] p-0 overflow-hidden">
                <DialogHeader className="p-6 border-b border-white/10">
                    <DialogTitle className="text-xl font-black text-center text-primary uppercase italic">卡池完整清冊</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-6">
                    <div className="space-y-8 pb-20">
                        {lastPrizeCard && (
                            <div className="border-2 p-6 rounded-[2.5rem] bg-accent/10 border-accent/40 flex flex-col sm:flex-row items-center gap-6">
                                <div className="relative w-32 aspect-[2.5/4] rounded-2xl overflow-hidden border-2 border-white/20 p-1">
                                    <SafeImage src={lastPrizeCard.imageUrl} alt="lp" sizes="120px" fill className="object-contain" />
                                </div>
                                <div className="text-center sm:text-left flex-1">
                                    <p className="text-lg font-black text-accent uppercase">最後賞：{lastPrizeCard.name}</p>
                                    <p className="text-sm text-white/60">最後一抽可得此 Legendary 資產。</p>
                                </div>
                            </div>
                        )}
                        {RARITIES.map(r => { 
                            const prizes = allPrizesInPool.filter(x => x.rarity === r); 
                            if (prizes.length === 0) return null; 
                            return (
                                <div key={r} className="space-y-4">
                                    <div className="flex items-center gap-3 border-l-4 pl-4 py-1" style={{ borderColor: rarityStyles[r].text }}>
                                        <h5 className={cn("font-black text-lg uppercase", rarityStyles[r].text)}>{rarityStyles[r].label}</h5>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {prizes.map(c => (
                                            <div key={c.id} className="text-center cursor-zoom-in" onClick={() => setPreviewCard(c)}>
                                                <div className={cn("relative aspect-[2.5/4] mb-2 rounded-xl border border-white/10 overflow-hidden p-1", c.isSoldOut && "grayscale opacity-40")}>
                                                    {c.isPoints ? (
                                                        <div className={cn("w-full h-full flex flex-col items-center justify-center rounded-lg", pointPrizeStyles[c.rarity as Rarity].bg)}>
                                                            <PPlusIcon className={cn("w-12 h-12 mb-2", pointPrizeStyles[c.rarity as Rarity].text)} />
                                                            <p className="font-headline text-lg font-black text-white">{c.points}</p>
                                                        </div>
                                                    ) : (
                                                        <SafeImage src={c.imageUrl} alt={c.name} sizes="120px" fill className="object-contain" />
                                                    )}
                                                    {c.isSoldOut && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <Badge variant="secondary" className="text-[8px] font-black uppercase">已售罄</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                {!c.isSoldOut && (
                                                    <Badge variant="outline" className="h-5 px-2 text-[8px] border-primary/20 text-primary">剩餘: {c.quantity} 包</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </DialogContent>

            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-6">
                            <h2 className="text-sm font-black text-white text-center">{previewCard.name}</h2>
                            <div className="w-full max-w-[400px]">
                                {previewCard.isPoints ? (
                                    <div className={cn("w-full aspect-[2.5/4] rounded-3xl flex flex-col items-center justify-center p-4 border shadow-2xl", pointPrizeStyles[previewCard.rarity as Rarity].bg, pointPrizeStyles[previewCard.rarity as Rarity].border)}>
                                        <PPlusIcon className={cn("w-20 h-20 mb-4", pointPrizeStyles[previewCard.rarity as Rarity].text)} />
                                        <p className="font-headline text-5xl font-black text-white">{previewCard.points}</p>
                                        <Badge variant="outline" className="mt-6 border-white/20 text-[10px] font-black uppercase tracking-widest text-white/40">Bonus Reward</Badge>
                                    </div>
                                ) : (
                                    <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity={previewCard.rarity} isFlippable={true}/>
                                )}
                            </div>
                            {!previewCard.isPoints && <p className="text-[9px] text-primary font-bold uppercase animate-pulse">點擊翻轉</p>}
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="mt-4 rounded-full bg-black/80 h-12 w-12 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-6 w-6" />
                    </Button>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}