'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CardItem } from '@/components/card-item';
import { cn } from '@/lib/utils';
import { Gem, Sparkles, Loader2, RotateCcw, ArrowLeft, PlayCircle, FastForward, Check, Disc3, RotateCw, Clock, ChevronsUp, X, ShieldCheck, Star, Trophy, Diamond, Layers, Zap, AlertCircle, Ban, ChevronRight } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDoc, doc, serverTimestamp, increment, runTransaction, getDocs, updateDoc, Timestamp, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import { Logo } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Firestore Error Object: ', error);
  const auth = getAuth(getApp());
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'unknown',
      email: auth.currentUser?.email || 'unknown',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Info: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Rarity = 'legendary' | 'rare' | 'common';
interface Card {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    category: string;
    sellPrice?: number;
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
    price?: number;
    price3Draws?: number;
    cards: { cardId: string; quantity: number }[];
    pointPrizes?: PointPrize[];
    cardRarities: Record<string, Rarity>;
    remainingPacks: number;
    totalPacks?: number;
    hasProtection?: boolean;
    currency?: 'diamond' | 'p-point';
    type?: string;
    name?: string;
    categoryId?: string;
    lastPrizeCardId?: string;
    lockedBy?: string;
    lockedAt?: { seconds: number; nanoseconds: number; };
    dailyLimit?: number;
    minLevel?: string;
}

type DrawnPrize = (Card & { rarity: Rarity; type: 'card' | 'last-prize'; serialNumber?: string }) | (PointPrize & { type: 'points'; rarity: Rarity });
type Step = 'init-loading' | 'waiting-to-start' | 'loading' | 'ready-to-reveal' | 'revealing' | 'done' | 'error';

const rarityVisuals: Record<Rarity, { color: string, glow: string, celebration: 'none' | 'rare' | 'legendary', label: string }> = {
  legendary: { color: 'text-accent', glow: 'shadow-[0_0_60px_rgba(234,179,8,0.6)]', celebration: 'legendary', label: 'LEGENDARY' },
  rare: { color: 'text-primary', glow: 'shadow-[0_0_50px_rgba(6,182,212,0.5)]', celebration: 'rare', label: 'RARE' },
  common: { color: 'text-slate-400', glow: 'shadow-white/5', celebration: 'none', label: 'COMMON' },
};

const pointPrizeRarityStyles: Record<Rarity, { text: string, bg: string, border: string }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10 backdrop-blur-xl', border: 'border-accent/30' },
  rare: { text: 'text-primary', bg: 'bg-primary/10 backdrop-blur-xl', border: 'border-primary/30' },
  common: { text: 'text-slate-400', bg: 'bg-white/5 backdrop-blur-xl', border: 'border-white/10' },
};

const LOCK_DURATION = 120;

function CelebrationVFX({ type }: { type: 'none' | 'rare' | 'legendary' }) {
    if (type === 'none') return null;
    const isLegendary = type === 'legendary';
    const colorClass = isLegendary ? 'text-accent' : 'text-primary';
    const glowColor = isLegendary ? 'rgba(234,179,8,0.3)' : 'rgba(6,182,212,0.15)';
    const starCount = isLegendary ? 45 : 30;

    return (
        <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
            <div className={cn("absolute inset-0 transition-opacity duration-2000", isLegendary ? "bg-accent/10" : "bg-primary/5")} />
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full animate-glow-burst" 
                style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }} 
            />
            {Array.from({ length: starCount }).map((_, i) => (
                <div 
                    key={i} 
                    className={cn("absolute animate-firework", colorClass)}
                    style={{ 
                        left: '50%', 
                        top: '50%',
                        transform: `rotate(${i * (360 / starCount)}deg) translate(${60 + Math.random() * (isLegendary ? 400 : 250)}px)`,
                        animationDelay: `${Math.random() * 0.8}s`,
                        opacity: 0
                    }}
                >
                    <Star className={cn(isLegendary ? "w-5 h-5 md:w-7 md:h-7" : "w-3 h-3 md:w-5 md:h-5", "fill-current")} />
                </div>
            ))}
        </div>
    );
}

export default function OpenPackPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    
    const [step, setStep] = useState<Step>('init-loading');
    const [drawnPrizes, setDrawnPrizes] = useState<DrawnPrize[]>([]);
    const [sessionPrizes, setSessionPrizes] = useState<DrawnPrize[]>([]); 
    const [revealedIndex, setRevealedIndex] = useState(-1);
    const [error, setError] = useState<string | null>(null);
    const [cashbackPPoints, setCashbackPPoints] = useState(0);
    const [cardPool, setCardPool] = useState<CardPool | null>(null);
    const [lockCountdown, setLockCountdown] = useState<number>(LOCK_DURATION);
    const [showCelebration, setShowCelebration] = useState<'none' | 'rare' | 'legendary'>('none');
    const [revealPercent, setRevealPercent] = useState(0);
    const [isSqueezing, setIsSqueezing] = useState(false);
    const [isChanging, setIsChanging] = useState(false); 
    
    // Reset timer on draw
    useEffect(() => {
        if (step === 'ready-to-reveal' || step === 'revealing') {
            setLockCountdown(LOCK_DURATION);
        }
    }, [step, revealedIndex]);

    const squeezeRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const poolId = searchParams.get('poolId');
    const initialDrawCount = parseInt(searchParams.get('draws') || '1', 10);
    
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const poolStatsRef = useMemoFirebase(() => 
        (firestore && user?.uid && poolId) ? doc(firestore, 'users', user.uid, 'poolStats', poolId) : null, 
        [firestore, user?.uid, poolId]
    );
    const { data: poolStats, isLoading: isLoadingStats } = useDoc<any>(poolStatsRef);

    const todayDrawCount = useMemo(() => {
        if (!poolStats || poolStats.lastDrawDate !== todayStr) return 0;
        return poolStats.count || 0;
    }, [poolStats, todayStr]);

    const isLimitReachedForInitial = useMemo(() => {
        if (!cardPool?.dailyLimit || cardPool.dailyLimit <= 0) return false;
        if (isLoadingStats) return true;
        return todayDrawCount + initialDrawCount > cardPool.dailyLimit;
    }, [cardPool, todayDrawCount, initialDrawCount, isLoadingStats]);

    const isLimitReachedForSingle = useMemo(() => {
        if (!cardPool?.dailyLimit || cardPool.dailyLimit <= 0) return false;
        return todayDrawCount + 1 > cardPool.dailyLimit;
    }, [cardPool, todayDrawCount]);

    useEffect(() => {
        if (!isMounted || step === 'done' || step === 'error' || step === 'waiting-to-start' || step === 'init-loading') return;
        const timer = setInterval(() => {
            setLockCountdown(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isMounted, step]);

    useEffect(() => {
        if (isUserLoading || !firestore || !poolId) return;
        if (!user) { setError("請先登入帳戶。"); setStep('error'); return; }
        getDoc(doc(firestore, 'cardPools', poolId)).then(snap => {
            if (!snap.exists()) throw new Error("找不到指定的卡池。");
            setCardPool({ id: snap.id, ...snap.data() } as CardPool);
            setStep('waiting-to-start');
        }).catch(e => { 
            console.error(e);
            setError(e.message); 
            setStep('error'); 
        });
    }, [isUserLoading, user, firestore, poolId]);

    const performDraw = useCallback(async (count: number) => {
        const isFromSummary = step === 'done';
        
        if (!poolId || !firestore || !user || !cardPool || !poolStatsRef) return;

        if (isLoadingStats || (cardPool.dailyLimit && cardPool.dailyLimit > 0 && todayDrawCount + count > cardPool.dailyLimit)) {
            toast({ variant: 'destructive', title: '操作被拒絕', description: '您今日的抽卡額度已達上限。' });
            return;
        }

        setStep('loading');
        setShowCelebration('none');
        setRevealPercent(0);
        setIsSqueezing(false);
        setIsChanging(false);
        
        try {
            const levelNames = userLevels.map(l => l.level);
            const userLevelIdx = userProfile ? levelNames.indexOf(userProfile.userLevel) : -1;
            const minLevelIdx = cardPool.minLevel ? levelNames.indexOf(cardPool.minLevel) : 0;
            if (userLevelIdx < minLevelIdx) {
                throw new Error(`本卡池僅限「${cardPool.minLevel}」以上等級參與。`);
            }

            // 提前檢查點數
            const cost = count === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * count;
            const currencyField = cardPool.currency === 'p-point' ? 'bonusPoints' : 'points';
            const userBalance = currencyField === 'bonusPoints' ? (userProfile?.bonusPoints || 0) : (userProfile?.points || 0);
            if (userBalance < cost) {
                throw new Error("點數不足，無法進行抽卡。");
            }

            setStep('loading');
            setShowCelebration('none');
            setRevealPercent(0);
            setIsSqueezing(false);
            setIsChanging(false);
            
            try {
                const result = await runTransaction(firestore, async (transaction) => {
                    const poolRef = doc(firestore, 'cardPools', poolId);
                    const userRef = doc(firestore, 'users', user.uid);
                    
                    const [pSnap, uSnap, sSnap] = await Promise.all([
                        transaction.get(poolRef), 
                        transaction.get(userRef),
                        transaction.get(poolStatsRef)
                    ]);
                    
                    if (!pSnap.exists() || !uSnap.exists()) throw new Error("同步失敗");
                    
                    const pData = pSnap.data() as CardPool;
                    const uData = uSnap.data() as UserProfile;
                    
                    let currentStatsCount = 0;
                    if (sSnap.exists() && sSnap.data().lastDrawDate === todayStr) {
                        currentStatsCount = sSnap.data().count || 0;
                    }
                    if (pData.dailyLimit && pData.dailyLimit > 0 && currentStatsCount + count > pData.dailyLimit) {
                        throw new Error("今日抽卡額度已達上限");
                    }

                    const actualCount = Math.min(count, pData.remainingPacks);
                    if (actualCount <= 0) throw new Error("卡池已售罄");
                    
                    // 再次確認點數 (交易內)
                    const finalCost = actualCount === 3 && pData.price3Draws ? pData.price3Draws : (pData.price || 0) * actualCount;
                    if ((currencyField === 'bonusPoints' ? uData.bonusPoints : uData.points) < finalCost) {
                        throw new Error("點數不足");
                    }
                    
                    const cardIds = pData.cards?.map(c => c.cardId) || [];
                    const cardDetailsMap = new Map<string, Card>();
                    if (cardIds.length > 0) {
                        const cardSnaps = await Promise.all(cardIds.map(id => transaction.get(doc(firestore, 'allCards', id))));
                        cardSnaps.forEach(s => { if(s.exists()) cardDetailsMap.set(s.id, s.data() as Card); });
                    }
                    
                    let weightedList: DrawnPrize[] = [];
                    pData.pointPrizes?.forEach(p => {
                        for (let i = 0; i < p.quantity; i++) {
                            weightedList.push({ ...p, type: 'points' });
                        }
                    });
                    pData.cards?.forEach(c => {
                        const details = cardDetailsMap.get(c.cardId);
                        const rarity = pData.cardRarities[c.cardId];
                        if (details && rarity && c.quantity > 0 && !details.isSold) {
                            for (let i = 0; i < c.quantity; i++) {
                                weightedList.push({ ...details, id: c.cardId, rarity, type: 'card' });
                            }
                        }
                    });
                    
                    const newBatch: DrawnPrize[] = [];
                    const updatedCards = [...(pData.cards || [])];
                    const updatedPoints = [...(pData.pointPrizes || [])];
                    
                    for (let i = 0; i < actualCount; i++) {
                        if (weightedList.length === 0) break;
                        const pickedIdx = Math.floor(Math.random() * weightedList.length);
                        const picked = weightedList.splice(pickedIdx, 1)[0];
                        
                        if (picked.type === 'card') {
                            const idx = updatedCards.findIndex(c => c.cardId === picked.id);
                            updatedCards[idx].quantity -= 1;
                            transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), { 
                                userId: user.uid, 
                                cardId: picked.id, 
                                rarity: picked.rarity, 
                                category: picked.category, 
                                isFoil: Math.random() < 0.05, 
                                source: 'draw' 
                            });
                            transaction.update(doc(firestore, 'allCards', picked.id), { isSold: true });
                            
                            transaction.set(doc(collection(firestore, 'drawnCardLogs')), {
                                cardId: picked.id,
                                sellPrice: (picked as Card).sellPrice || 0,
                                poolId: poolId,
                                userId: user.uid,
                                timestamp: serverTimestamp()
                            });
                            
                            if (picked.rarity === 'legendary') {
                                transaction.set(doc(collection(firestore, 'announcements')), {
                                    username: uData.username,
                                    action: '抽中',
                                    prize: picked.name,
                                    prizeImageUrl: picked.imageUrl,
                                    rarity: 'legendary',
                                    timestamp: serverTimestamp(),
                                    section: 'draw'
                                });
                            }
                        } else if (picked.type === 'points') {
                            const idx = updatedPoints.findIndex(p => p.prizeId === (picked as PointPrize).prizeId);
                            updatedPoints[idx].quantity -= 1;
                            
                            if (picked.rarity === 'legendary') {
                                transaction.set(doc(collection(firestore, 'announcements')), {
                                    username: uData.username,
                                    action: '抽中',
                                    prize: `${(picked as PointPrize).points} P+ 點數`,
                                    rarity: 'legendary',
                                    timestamp: serverTimestamp(),
                                    section: 'draw'
                                });
                            }
                        }
                        (picked as any).serialNumber = `${Math.floor(Math.random() * 9000) + 1000}`;
                        newBatch.push(picked);
                    }
                    
                    let lpPrize: DrawnPrize | null = null;
                    const newRemaining = pData.remainingPacks - actualCount;
                    if (pData.remainingPacks > 0 && newRemaining <= 0 && pData.lastPrizeCardId) {
                        const lpSnap = await transaction.get(doc(firestore, 'allCards', pData.lastPrizeCardId));
                        if (lpSnap.exists()) {
                            const lpData = lpSnap.data() as Card;
                            lpPrize = { ...lpData, id: lpSnap.id, rarity: 'legendary', type: 'last-prize', serialNumber: 'LP-1000' };
                            transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), { 
                                userId: user.uid, 
                                cardId: lpSnap.id, 
                                rarity: 'legendary', 
                                category: lpData.category, 
                                isFoil: true, 
                                source: 'last-prize' 
                            });
                            transaction.update(doc(firestore, 'allCards', lpSnap.id), { isSold: true });
                            
                            transaction.set(doc(collection(firestore, 'drawnCardLogs')), {
                                cardId: lpSnap.id,
                                sellPrice: lpData.sellPrice || 0,
                                poolId: poolId,
                                userId: user.uid,
                                timestamp: serverTimestamp()
                            });
                            
                            transaction.set(doc(collection(firestore, 'announcements')), {
                                username: uData.username,
                                action: '獲得最後賞',
                                prize: lpData.name,
                                prizeImageUrl: lpData.imageUrl,
                                rarity: 'legendary',
                                timestamp: serverTimestamp(),
                                section: 'draw'
                            });
                        }
                    }
                    
                    const totalPPoints = newBatch.reduce((s, p) => p.type === 'points' ? s + (p as PointPrize).points : s, 0);
                    let cashback = 0;
                    if (pData.currency !== 'p-point' && systemConfig?.levelBenefits) {
                        const benefit = systemConfig.levelBenefits.find(b => b.level === uData.userLevel);
                        if (benefit?.cashbackRate) {
                            cashback = Math.floor(finalCost * (benefit.cashbackRate / 100));
                        }
                    }
                    
                    transaction.update(userRef, { 
                        [currencyField]: increment(-finalCost), 
                        bonusPoints: increment(totalPPoints + cashback), 
                        totalSpent: pData.currency !== 'p-point' ? increment(finalCost) : increment(0) 
                    });
                    
                    transaction.set(poolStatsRef, {
                        count: currentStatsCount + actualCount,
                        lastDrawDate: todayStr,
                        updatedAt: serverTimestamp()
                    }, { merge: true });
    
                    transaction.update(poolRef, { 
                        remainingPacks: newRemaining, 
                        cards: updatedCards, 
                        pointPrizes: updatedPoints, 
                        lockedBy: user.uid, 
                        lockedAt: serverTimestamp() 
                    });
                    
                    transaction.set(doc(collection(firestore, 'transactions'), `${user.uid}_${Date.now()}`), { 
                        userId: user.uid, 
                        targetId: poolId, 
                        transactionType: 'Purchase', 
                        section: 'draw', 
                        currency: pData.currency || 'diamond', 
                        amount: -finalCost, 
                        details: `Draw ${actualCount} from pool: ${pData.name}`, 
                        transactionDate: serverTimestamp() 
                    });
                    
                    return { newBatch, lpPrize, cashback, newRemaining, updatedCards, updatedPoints };
                });
                
                if (result) {
                    const combined = [...result.newBatch];
                    if (result.lpPrize) combined.push(result.lpPrize);
                    
                    setDrawnPrizes(combined);
                    if (isFromSummary) {
                        setSessionPrizes(combined);
                    } else {
                        setSessionPrizes(prev => [...prev, ...combined]);
                    }
                    setRevealedIndex(0);
                    setCashbackPPoints(result.cashback);
                    setCardPool(prev => prev ? ({ ...prev, remainingPacks: result.newRemaining, cards: result.updatedCards, pointPrizes: result.updatedPoints, lockedAt: { seconds: Math.floor(Date.now()/1000), nanoseconds: 0 } }) : null);
                    setTimeout(() => setStep('ready-to-reveal'), 800);
                }
            } catch (e: any) { 
                handleFirestoreError(e, OperationType.WRITE, 'transaction');
            }
        } catch (e: any) { 
            console.error(e);
            setError(e.message); 
            setStep('error'); 
        }
    }, [poolId, firestore, user, userProfile, systemConfig, cardPool, step, todayDrawCount, isLoadingStats, poolStatsRef, todayStr, toast]);

    const handleSqueezeStart = (e: React.PointerEvent) => { 
        if (step !== 'ready-to-reveal' || isChanging) return; 
        window.getSelection()?.removeAllRanges();
        setIsSqueezing(true); 
        startY.current = e.clientY; 
        (e.target as HTMLElement).setPointerCapture(e.pointerId); 
    };
    
    const handleSqueezeMove = (e: React.PointerEvent) => { 
        if (!isSqueezing) return; 
        const deltaY = startY.current - e.clientY; 
        const containerHeight = squeezeRef.current?.offsetHeight || 400; 
        setRevealPercent(Math.max(0, Math.min(100, (deltaY / (containerHeight * 0.6)) * 100))); 
    };
    
    const handleSqueezeEnd = () => { 
        if (!isSqueezing) return; 
        setIsSqueezing(false); 
        if (revealPercent > 60) { 
            completeReveal();
        } else {
            setRevealPercent(0); 
        }
    };

    const completeReveal = () => {
        setRevealPercent(100); 
        setStep('revealing'); 
        const p = drawnPrizes[revealedIndex]; 
        if (p && rarityVisuals[p.rarity].celebration !== 'none') {
            setShowCelebration(rarityVisuals[p.rarity].celebration);
        }
    };

    const nextPrize = () => {
        if (isChanging) return;
        window.getSelection()?.removeAllRanges();
        
        setIsChanging(true);
        setRevealPercent(0);
        setIsSqueezing(false);
        setShowCelebration('none');
        
        setTimeout(() => {
            setRevealedIndex(prev => prev + 1);
            setStep('ready-to-reveal');
            
            setTimeout(() => {
                setIsChanging(false);
            }, 200);
        }, 400);
    };

    if (step === 'init-loading' || !isMounted) {
        return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;
    }

    if (step === 'waiting-to-start' && cardPool) {
        const cost = initialDrawCount === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * initialDrawCount;
        const levelNames = userLevels.map(l => l.level);
        const userLevelIdx = userProfile ? levelNames.indexOf(userProfile.userLevel) : -1;
        const minLevelIdx = cardPool.minLevel ? levelNames.indexOf(cardPool.minLevel) : 0;
        const isLevelMet = userLevelIdx >= minLevelIdx;
        
        return (
            <div className="flex flex-col items-center min-h-screen p-2 pt-10 md:pt-32 relative select-none">
                <Button variant="ghost" onClick={() => router.back()} className="absolute top-4 left-4 font-bold text-white/40 z-50 text-xs"><ArrowLeft className="mr-1 h-3 w-3" /> 返回</Button>
                <div className="w-full max-w-[340px] space-y-4 animate-fade-in-up">
                    <div className="relative p-2 bg-slate-900 border-[6px] border-slate-950 rounded-[2rem] shadow-2xl overflow-hidden">
                        <div className="bg-black rounded-[1.5rem] border-[6px] border-slate-950 overflow-hidden p-4 space-y-4 text-center">
                            <Logo className="mx-auto scale-75" asStatic />
                            <h2 className="text-xs md:text-base font-headline font-black text-white uppercase truncate px-2">{cardPool.name}</h2>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 bg-white/5 rounded-xl border border-white/10"><span className="text-[7px] text-muted-foreground font-black block uppercase">本次抽數</span><span className="text-base font-black text-white">{initialDrawCount} 包</span></div>
                                <div className="p-2 bg-primary/10 rounded-xl border border-primary/20"><span className="text-[7px] text-primary font-black block uppercase">預計花費</span><div className="text-base font-black text-white flex items-center justify-center gap-1">{cost.toLocaleString()} {cardPool.currency === 'p-point' ? <PPlusIcon className="h-3 w-3" /> : <Gem className="h-3 w-3 text-primary"/>}</div></div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {cardPool.minLevel && cardPool.minLevel !== '新手收藏家' && (
                                    <div className={cn("p-2 rounded-xl border flex items-center justify-center gap-2", isLevelMet ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-rose-500/10 border-rose-500/30 text-rose-500")}><ShieldCheck className="w-3 h-3" /><span className="text-[9px] font-black uppercase">等級限制: {cardPool.minLevel}</span></div>
                                )}
                                {cardPool.dailyLimit && cardPool.dailyLimit > 0 && (
                                    <div className={cn(
                                        "p-2 rounded-xl border flex items-center justify-center gap-2 transition-all duration-500", 
                                        isLimitReachedForInitial ? "bg-rose-600 border-rose-400 text-white" : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                    )}>
                                        <Ban className="w-3 h-3" />
                                        <span className="text-[9px] font-black uppercase">每日限購: {cardPool.dailyLimit} 包 (今日已抽: {todayDrawCount})</span>
                                    </div>
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

    if (step === 'loading' || step === 'error') {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 text-white select-none">
                <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
                <p className="text-muted-foreground">{step === 'loading' ? '正在從資料庫讀取卡包...' : error}</p>
                {step === 'error' && <Button className="mt-6 rounded-xl font-bold px-10" asChild><Link href="/draw">返回抽卡專區</Link></Button>}
            </div>
        );
    }

    const currentPrize = drawnPrizes[revealedIndex];
    const visual = currentPrize ? (rarityVisuals[currentPrize.rarity] || rarityVisuals.common) : rarityVisuals.common;

    const canDraw3 = !isLoadingStats && (!cardPool?.dailyLimit || cardPool.dailyLimit === 0 || (todayDrawCount + 3 <= cardPool.dailyLimit));

    return (
        <div className="flex flex-col items-center h-screen p-2 pt-2 relative overflow-hidden select-none touch-none justify-start md:justify-center"
             style={{
                 backgroundImage: 'url("/draw-background.png.png")',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center'
             }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <CelebrationVFX type={showCelebration} />
            <Button variant="ghost" onClick={() => router.back()} className="absolute top-2 left-2 font-bold text-white/40 z-50 text-xs"><ArrowLeft className="mr-1 h-3 w-3" /> 返回</Button>
            
            <div className="w-full flex flex-col items-center justify-end pb-1 min-h-[40px] z-10 select-none mt-10 md:mt-0">
                {step !== 'done' && step !== 'waiting-to-start' && step !== 'init-loading' && (
                    <div className="flex justify-center mb-1">
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[8px] font-black uppercase shadow-xl backdrop-blur-md">
                            <ShieldCheck className="h-2.5 w-2.5" /> 保護時間剩餘 {lockCountdown} 秒
                        </div>
                    </div>
                )}
                {(step === 'ready-to-reveal' || step === 'revealing') && currentPrize && revealPercent === 100 && (
                    <div className="text-center animate-fade-in-up select-none">
                        <p className="text-[9px] text-white/40 uppercase font-black tracking-[0.2em]">{currentPrize.type === 'last-prize' ? '最後賞限定' : `第 ${revealedIndex + 1} 項結果`}</p>
                        <div className="flex items-center justify-center gap-1.5">
                            {(currentPrize.type === 'points') ? (
                                <div className="flex items-center gap-1.5">
                                    <PPlusIcon className="w-6 h-6" />
                                    <span className="text-2xl md:text-3xl font-black font-headline text-white">+{currentPrize.points}</span>
                                </div>
                            ) : (
                                <h2 className="text-lg md:text-2xl font-headline font-black text-white uppercase drop-shadow-lg truncate max-w-[280px]">{currentPrize.name}</h2>
                            )}
                        </div>
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.3em] mt-0.5", visual.color)}>{visual.label}</p>
                    </div>
                )}
                {step === 'done' && (
                    <div className="text-center animate-fade-in-up mb-1 select-none">
                        <h2 className="text-2xl md:text-4xl font-headline font-black text-white uppercase italic drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">開獎結算</h2>
                        <p className="text-[9px] text-primary font-bold mt-1 uppercase tracking-[0.2em]">本次遊玩共獲得 {sessionPrizes.length} 項戰利品</p>
                    </div>
                )}
            </div>

            {step !== 'done' ? (
                <div className="flex flex-col items-center justify-center pt-2 w-full relative transition-all duration-500 select-none">
                    <div className="flex flex-col items-center w-full max-w-[170px] md:max-w-[220px] relative">
                        <div className={cn("relative p-1 bg-slate-900 border-[5px] border-slate-950 rounded-[2.2rem] shadow-2xl overflow-hidden w-full transition-all duration-700", step === 'revealing' && revealPercent === 100 && visual.glow)}>
                            <div 
                                ref={squeezeRef} 
                                className="relative bg-transparent rounded-[1.1rem] border-[5px] border-slate-950 overflow-hidden aspect-[2.5/4] flex items-center justify-center touch-none cursor-pointer select-none transition-transform duration-100"
                                style={{ transform: isSqueezing ? `perspective(1000px) rotateX(${revealPercent * 0.2}deg) rotateY(-${revealPercent * 0.1}deg) scale(1.05)` : 'none' }}
                                onPointerDown={handleSqueezeStart} 
                                onPointerMove={handleSqueezeMove} 
                                onPointerUp={handleSqueezeEnd} 
                                onPointerCancel={handleSqueezeEnd}
                            >
                                <div className={cn(
                                    "relative w-full h-full z-10 flex items-center justify-center pointer-events-none p-1.5 select-none transition-opacity duration-200",
                                    isChanging ? "opacity-0" : "opacity-100"
                                )}>
                                    {currentPrize && (
                                        (currentPrize.type === 'card' || currentPrize.type === 'last-prize') ? (
                                            <div className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                                <CardItem 
                                                    name={currentPrize.name} 
                                                    imageUrl={currentPrize.imageUrl} 
                                                    backImageUrl={currentPrize.backImageUrl} 
                                                    imageHint={currentPrize.name} 
                                                    rarity={currentPrize.rarity} 
                                                    serialNumber={currentPrize.serialNumber} 
                                                    isFlippable={true} 
                                                    priority 
                                                />
                                            </div>
                                        ) : (
                                            <div className={cn("w-full h-full flex flex-col items-center justify-center p-3 rounded-xl shadow-inner border-2", pointPrizeRarityStyles[currentPrize.rarity].bg, pointPrizeRarityStyles[currentPrize.rarity].border)}>
                                                <PPlusIcon className={cn("w-16 h-16 mb-4 drop-shadow-[0_0_20px_currentColor]", pointPrizeRarityStyles[currentPrize.rarity].text)} />
                                                <p className="font-headline text-4xl font-black text-white drop-shadow-lg">{currentPrize.points}</p>
                                                <Badge variant="outline" className="mt-4 border-white/20 text-[8px] font-black uppercase tracking-widest text-white/40">Digital Bonus</Badge>
                                            </div>
                                        )
                                    )}
                                </div>
                                
                                <div 
                                    className={cn(
                                        "absolute inset-0 z-30 bg-slate-900 rounded-xl border-4 border-primary/50 flex flex-col items-center justify-center pointer-events-none select-none shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]",
                                        (!isSqueezing && (revealPercent === 0 || isChanging)) ? "" : "transition-all duration-500 ease-out",
                                        (revealPercent >= 100) ? "opacity-0" : "opacity-100"
                                    )} 
                                    style={{ transform: `translateY(-${revealPercent}%)` }} 
                                >
                                    {/* 3D Side Edge */}
                                    <div className="absolute -right-2 top-2 bottom-2 w-2 bg-primary/20 rounded-r-lg shadow-lg" />
                                    <div className="absolute -bottom-2 left-2 right-2 h-2 bg-primary/20 rounded-b-lg shadow-lg" />
                                    
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-primary blur-xl opacity-30 animate-pulse" />
                                        <Disc3 className="w-12 h-12 text-primary animate-spin-slow mb-3 relative z-10" />
                                    </div>
                                    <span className="font-headline text-sm font-black text-primary tracking-[0.3em] italic drop-shadow-md">P+ CARDER</span>
                                    <p className="text-[9px] text-primary/60 mt-4 animate-pulse uppercase font-black tracking-widest">往上掀開</p>
                                </div>
                            </div>
                        </div>
                        {step === 'ready-to-reveal' && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={completeReveal}
                                className="mt-4 h-8 px-6 rounded-full bg-white/10 border border-white/20 text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:bg-primary/20 transition-all shadow-xl"
                            >
                                <FastForward className="w-3 h-3 mr-1.5 animate-pulse" /> 快速開獎 SKIP
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-6xl px-4 z-20 overflow-y-auto custom-scrollbar select-none flex-grow mt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 py-1">
                        {sessionPrizes.map((p, i) => (
                            <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                                {p.type === 'points' ? (
                                    <div className={cn(
                                        "w-full aspect-[2.5/4] rounded-3xl flex flex-col items-center justify-center p-4 border shadow-2xl transition-all hover:scale-105 group",
                                        pointPrizeRarityStyles[p.rarity].bg,
                                        pointPrizeRarityStyles[p.rarity].border
                                    )}>
                                        <div className="relative mb-2">
                                            <div className="absolute inset-0 blur-2xl opacity-40 group-hover:opacity-80 transition-opacity bg-current" style={{ color: 'hsl(var(--accent))' }} />
                                            <PPlusIcon className={cn("w-12 h-12 md:w-16 md:h-16 relative z-10", pointPrizeRarityStyles[p.rarity].text)} />
                                        </div>
                                        <p className="font-code text-2xl md:text-3xl font-black text-white drop-shadow-md">{p.points}</p>
                                        <Badge variant="outline" className="mt-3 border-white/5 bg-black/20 text-[8px] font-black uppercase text-white/30">Bonus Reward</Badge>
                                    </div>
                                ) : (
                                    <div className="relative group transition-all hover:scale-105">
                                        <CardItem 
                                            name={p.name} 
                                            imageUrl={p.imageUrl} 
                                            backImageUrl={p.backImageUrl} 
                                            imageHint={p.name} 
                                            rarity={p.rarity} 
                                            serialNumber={p.serialNumber} 
                                            isFlippable={true} 
                                        />
                                        {p.type === 'last-prize' && (
                                            <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground font-black text-[8px] h-5 px-2 shadow-xl border-none">
                                                LAST ONE
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="w-full flex flex-col items-center gap-1 z-30 pt-2 pb-2 select-none mt-4">
                 {(step === 'revealing' || step === 'done') && (
                    <div className={cn(
                        "bg-black/85 backdrop-blur-3xl border border-white/10 p-3 rounded-[2rem] w-full max-w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-fade-in-up transition-all"
                    )}>
                        {cashbackPPoints > 0 && (
                            <div className="flex items-center justify-center gap-2 font-black text-[9px] uppercase mb-1 text-accent animate-pulse">
                                <Sparkles className="w-3 h-3" />
                                <span>VIP回饋: +{cashbackPPoints}</span>
                                <PPlusIcon className="w-3 h-3" />
                            </div>
                        )
                        }
                        
                        {step === 'revealing' && revealedIndex < drawnPrizes.length - 1 ? (
                            <Button 
                                onClick={nextPrize} 
                                className="w-full h-9 font-black bg-primary text-primary-foreground rounded-xl shadow-xl text-sm hover:scale-105 active:scale-95 transition-all"
                            >
                                {drawnPrizes[revealedIndex+1]?.type === 'last-prize' ? '🎉 揭曉最後賞限定！' : `揭曉下一項 (${revealedIndex+1}/${drawnPrizes.length})`}
                            </Button>
                        ) : (step === 'done' || (step === 'revealing' && revealedIndex === drawnPrizes.length - 1)) && (
                            <div className="grid grid-cols-2 gap-2">
                                {isLimitReachedForSingle ? (
                                    <Button 
                                        disabled 
                                        className="col-span-2 h-9 text-[10px] font-black rounded-xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic"
                                    >
                                        今日次數已用完
                                    </Button>
                                ) : (
                                    <>
                                        <Button 
                                            className={cn(
                                                "h-9 text-[10px] font-black border transition-all shadow-lg rounded-xl",
                                                isLoadingStats ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50" : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                                            )}
                                            onClick={() => performDraw(1)} 
                                            disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 1}
                                        >
                                            {isLoadingStats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 再抽 1 次</>}
                                        </Button>
                                        <Button 
                                            className={cn(
                                                "h-9 text-[10px] font-black rounded-xl transition-all shadow-lg",
                                                (isLoadingStats || !canDraw3) ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50" : "bg-accent text-accent-foreground hover:bg-accent/90"
                                            )}
                                            onClick={() => performDraw(3)} 
                                            disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 3 || !canDraw3}
                                        >
                                            {isLoadingStats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !canDraw3 ? '今日額度不足三抽' : '再抽 3 次'}
                                        </Button>
                                    </>
                                )}
                                <Button asChild variant="outline" className="h-9 text-[10px] font-black border-white/10 rounded-xl bg-white/5 hover:bg-white/10">
                                    <Link href="/draw">返回卡池</Link>
                                </Button>
                                
                                {step === 'done' ? (
                                    <Button asChild variant="outline" className="h-9 text-[10px] font-black border-primary/40 text-primary rounded-xl bg-primary/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-primary/10">
                                        <Link href="/collection">前往收藏庫</Link>
                                    </Button>
                                ) : (
                                    <Button 
                                        onClick={() => setStep('done')} 
                                        variant="outline" 
                                        className="h-9 text-[10px] font-black border-primary/40 text-primary rounded-xl bg-primary/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-primary/10 animate-pulse"
                                    >
                                        查看本次總結
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                 )}
            </div>
        </div>
    );
}