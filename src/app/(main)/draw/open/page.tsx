'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CardItem } from '@/components/card-item';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Gem, Sparkles, Loader2, RotateCcw, ArrowLeft, PlayCircle, FastForward, Check, Disc3, RotateCw, Clock, ChevronsUp, X, ShieldCheck, Star, Trophy, Layers, Zap, AlertCircle, Ban, ChevronRight, Hash } from 'lucide-react';
import { PackPreview, RevealComponent, DrawResults, CelebrationVFX } from '@/components/draw';
import { rarityVisuals, pointPrizeRarityStyles } from '@/lib/draw-constants';
import { drawFromPool } from '@/lib/draw-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, getDoc, doc, serverTimestamp, increment, runTransaction, getDocs, updateDoc, Timestamp, limit, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import type { Card, CardPool, DrawnPrize, PointPrize, Rarity, Step } from '@/types/draw';
import { Logo, PPlusIcon } from '@/components/icons';
import { DrawButtons } from '@/components/draw-buttons';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { performDrawAction } from '@/app/actions/draw';

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
  
  // 紀錄完整的除錯資訊到 console
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
  };
  console.error('Firestore Error Info: ', JSON.stringify(errInfo));

  // 轉換為親切提示
  let userFriendlyMessage = '系統發生異常，請稍後再試。';
  const errorMessage = errInfo.error.toLowerCase();

  if (errorMessage.includes('permission')) {
    userFriendlyMessage = '權限不足，請重新整理頁面。';
  } else if (errorMessage.includes('unavailable') || errorMessage.includes('timeout')) {
    userFriendlyMessage = '交易逾時，若點數已扣除請稍候查看背包。';
  } else if (errorMessage.includes('insufficient') || errorMessage.includes('點數不足')) {
    userFriendlyMessage = '點數不足，無法進行抽卡。';
  } else if (errorMessage.includes('fully sold') || errorMessage.includes('sold out')) {
    userFriendlyMessage = '卡包已售罄。';
  }

  throw new Error(userFriendlyMessage);
}

// Types moved to @/types/draw.ts

const LOCK_DURATION = 120;

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
    const [landingVFX, setLandingVFX] = useState<'none' | 'rare' | 'legendary'>('none');
    const [previewCard, setPreviewCard] = useState<any | null>(null);

    const topRarityCelebration = useMemo(() => {
        if (drawnPrizes.length === 0) return 'none';
        const hasLegendary = drawnPrizes.some(p => p.rarity === 'legendary');
        const hasRare = drawnPrizes.some(p => p.rarity === 'rare');
        return hasLegendary ? 'legendary' : (hasRare ? 'rare' : 'none');
    }, [drawnPrizes]);
    
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
        if (!user || !firestore || !cardPool) {
            toast({ variant: 'destructive', title: '錯誤', description: '系統尚未就緒或您尚未登入。' });
            return;
        }
        if (!poolId) return;

        setStep('loading');
        
        try {
            const result = await runTransaction(firestore, async (transaction) => {
                const userDocRef = doc(firestore, 'users', user.uid);
                const poolDocRef = doc(firestore, 'cardPools', poolId);
                const poolStatsRef = doc(firestore, 'users', user.uid, 'poolStats', poolId);                

                // 1. 讀取最新資料
                const userSnap = await transaction.get(userDocRef);
                const poolSnap = await transaction.get(poolDocRef);
                const poolStatsSnap = await transaction.get(poolStatsRef);

                if (!poolSnap.exists()) throw new Error('此卡池已下架或不存在。');
                
                let userData = userSnap.data();
                if (!userSnap.exists()) {
                    userData = {
                        id: user.uid,
                        username: user.displayName || '新玩家',
                        points: 1000,
                        bonusPoints: 0,
                        role: 'user',
                        userLevel: '普通會員',
                        createdAt: serverTimestamp()
                    };
                    transaction.set(userDocRef, userData);
                }

                const poolData = poolSnap.data() as CardPool;
                const cost = count === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * count;
                const currencyField = cardPool.currency === 'p-point' ? 'bonusPoints' : 'points';
                const balance = (userData as any)[currencyField] || 0;

                if (balance < cost) throw new Error('點數不足，無法抽卡。');

                // 2. 進行抽選
                const { drawn, updatedCards, updatedPointPrizes } = drawFromPool(poolData, count);

                if (drawn.length === 0) throw new Error('卡池目前已無獎項可供抽取。');

                // 3. 處理獲獎結果並存檔
                let winBonusPoints = 0;

                for (const prize of drawn) {
                    if (prize.type === 'points') {
                        // Always award P-points (bonusPoints)
                        winBonusPoints += prize.points;
                    } else {
                        // 儲存卡片到使用者收藏
                        const newUserCardRef = doc(collection(firestore, 'users', user.uid, 'userCards'));
                        const serialNumber = `${Math.floor(Math.random() * 9000) + 1000}`;
                        transaction.set(newUserCardRef, {
                            cardId: (prize as any).id,
                            userId: user.uid,
                            category: (prize as any).category,
                            rarity: (prize as any).rarity,
                            isFoil: (prize as any).rarity === 'legendary',
                            source: 'draw',
                            poolId: poolId,
                            serialNumber: serialNumber,
                            createdAt: serverTimestamp()
                        });
                        // 同步更新本地顯示的 ID (雖然目前是用 prize.id，但我們可以多加資訊)
                        (prize as any).serialNumber = serialNumber;
                    }
                }

                // 4. 套用使用者資產更新 (扣除花費 + 加入贏得的點數)
                const updateFields: any = {};
                if (cardPool.currency === 'p-point') {
                    updateFields.bonusPoints = increment(-cost + winBonusPoints);
                } else {
                    updateFields.points = increment(-cost);
                    if (winBonusPoints > 0) {
                        updateFields.bonusPoints = increment(winBonusPoints);
                    }
                }
                transaction.update(userDocRef, updateFields);

                // 5. 更新卡池資料
                transaction.update(poolDocRef, {
                    remainingPacks: increment(-drawn.length),
                    cards: updatedCards,
                    pointPrizes: updatedPointPrizes
                });

                // 6. 紀錄交易日誌
                const transactionRef = doc(collection(firestore, 'transactions'));
                transaction.set(transactionRef, {
                    userId: user.uid,
                    transactionType: 'Draw',
                    currency: cardPool.currency || 'diamond',
                    amount: -cost,
                    details: `在卡池 [${cardPool.name}] 進行 ${count} 連抽`,
                    transactionDate: serverTimestamp(),
                    section: 'draw'
                });
                
                // 7. 更新統計 (統計邏輯)
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const poolStatsData = poolStatsSnap.exists() ? poolStatsSnap.data() : { count: 0, lastDrawDate: '' };
                const newCount = (poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0) + drawn.length;
                transaction.set(poolStatsRef, {
                  count: newCount,
                  lastDrawDate: todayStr
                }, { merge: true });

                if (winBonusPoints > 0) {
                    const winTxRef = doc(collection(firestore, 'transactions'));
                    transaction.set(winTxRef, {
                        userId: user.uid,
                        transactionType: 'Win',
                        currency: 'p-point',
                        amount: winBonusPoints,
                        details: `卡池 [${cardPool.name}] 中獎點數回饋`,
                        transactionDate: serverTimestamp(),
                        section: 'draw'
                    });
                }

                return { drawn };
            });

            if (result && result.drawn) {
                // 非同步更新頁面狀態
                setDrawnPrizes(result.drawn);
                setSessionPrizes(prev => [...prev, ...result.drawn]);
                setRevealedIndex(0);
                setRevealPercent(0);
                setIsSqueezing(false);
                setShowCelebration('none');
                setLandingVFX('none');
                setStep('ready-to-reveal');
            }

        } catch (error: any) {
            console.error("抽卡失敗:", error);
            setError(error.message);
            setStep('error');
            
            if (error.message.includes('permission')) {
                toast({ 
                    variant: 'destructive', 
                    title: '連線被阻擋', 
                    description: 'Firestore 規則可能已恢復限制，請確認 Rules 設定。' 
                });
            }
        }
    }, [poolId, firestore, user, cardPool, toast]);

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
        const levelNames = userLevels.map(l => l.level);
        const userLevelIdx = userProfile ? levelNames.indexOf(userProfile.userLevel) : -1;
        const minLevelIdx = cardPool.minLevel ? levelNames.indexOf(cardPool.minLevel) : 0;
        const isLevelMet = userLevelIdx >= minLevelIdx;
        
        return (
            <PackPreview 
                cardPool={cardPool}
                initialDrawCount={initialDrawCount}
                isLevelMet={isLevelMet}
                isLimitReachedForInitial={isLimitReachedForInitial}
                isLoadingStats={isLoadingStats}
                performDraw={performDraw}
            />
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
        <div className="flex flex-col items-center h-screen p-2 pt-2 relative overflow-hidden select-none touch-none justify-start md:justify-center" style={{ backgroundImage: 'url("/draw_background.png")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
            <CelebrationVFX type={landingVFX !== 'none' ? landingVFX : showCelebration} />
            <Button variant="ghost" onClick={() => router.back()} className="absolute top-2 left-2 font-bold text-white/40 z-[20] text-xs"><ArrowLeft className="mr-1 h-3 w-3" /> 返回</Button>
            
            <div className="w-full flex flex-col items-center justify-end pb-1 min-h-[40px] z-[15] select-none mt-2 md:mt-0">
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
                <div className="flex flex-col items-center justify-center pt-2 w-full relative transition-all duration-500 select-none z-[20]">
                    <motion.div 
                        initial={{ y: -800, opacity: 0, scale: 0.2, rotate: -45, filter: 'blur(50px)' }}
                        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                        onAnimationComplete={() => {
                            if (topRarityCelebration !== 'none' && landingVFX === 'none') {
                                setLandingVFX(topRarityCelebration);
                                setTimeout(() => setLandingVFX('none'), 2000);
                            }
                        }}
                        transition={{ 
                            type: 'spring', 
                            stiffness: 120, 
                            damping: 10,
                            mass: 1.5,
                            duration: 1.2
                        }}
                        className="flex flex-col items-center w-full max-w-[170px] md:max-w-[220px] relative"
                    >
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
                    </motion.div>
                </div>
            ) : (
                <div className="w-full max-w-6xl px-4 z-20 mt-0 flex flex-col relative select-none">
                    <div className="relative group">
                        <div id="prize-scroll-container" className="flex flex-row gap-4 py-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth">
                            {sessionPrizes.map((p, i) => (
                                <div key={i} className="animate-fade-in-up snap-center w-[160px] md:w-[200px] flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }}>
                                    {p.type === 'points' ? (
                                        <div 
                                            className={cn(
                                                "w-full aspect-[2.5/4] rounded-3xl flex flex-col items-center justify-center p-4 border shadow-2xl transition-all hover:scale-105 group cursor-pointer",
                                                pointPrizeRarityStyles[p.rarity].bg,
                                                pointPrizeRarityStyles[p.rarity].border
                                            )}
                                            onClick={() => setPreviewCard({ ...p, isPoints: true })}
                                        >
                                            <div className="relative mb-2">
                                                <div className="absolute inset-0 blur-2xl opacity-40 group-hover:opacity-80 transition-opacity bg-current" style={{ color: 'hsl(var(--accent))' }} />
                                                <PPlusIcon className={cn("w-12 h-12 md:w-16 md:h-16 relative z-10", pointPrizeRarityStyles[p.rarity].text)} />
                                            </div>
                                            <p className="font-code text-2xl md:text-3xl font-black text-white drop-shadow-md">{p.points}</p>
                                            <Badge variant="outline" className="mt-3 border-white/5 bg-black/20 text-[8px] font-black uppercase text-white/30">Bonus Reward</Badge>
                                        </div>
                                    ) : (
                                        <div 
                                            className="w-full aspect-[2.5/4] rounded-3xl overflow-hidden shadow-2xl transition-all hover:scale-105 group border border-white/5 h-full cursor-zoom-in"
                                            onClick={() => setPreviewCard({ ...p, rarity: p.rarity })}
                                        >
                                            <CardItem 
                                                name={p.name} 
                                                imageUrl={p.imageUrl}
                                                backImageUrl={p.backImageUrl} 
                                                imageHint={p.name} 
                                                rarity={p.rarity} 
                                                className="h-full"
                                                isFlippable={false}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* 電腦版點擊箭頭 */}
                        {sessionPrizes.length > 2 && (
                            <>
                                <button 
                                    className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 backdrop-blur-md p-4 rounded-r-full border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500/20 transition-all hidden md:block"
                                    onClick={() => {
                                        const container = document.getElementById('prize-scroll-container');
                                        if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                                    }}
                                >
                                    <ChevronRight className="w-8 h-8 text-red-500 rotate-180" />
                                </button>

                                <button 
                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 backdrop-blur-md p-4 rounded-l-full border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500/20 transition-all hidden md:block"
                                    onClick={() => {
                                        const container = document.getElementById('prize-scroll-container');
                                        if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                                    }}
                                >
                                    <ChevronRight className="w-8 h-8 text-red-500" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="w-full flex flex-col items-center gap-1 z-30 pt-2 pb-2 select-none -mt-4 mb-8">
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
                        )}
                        
                        {step === 'revealing' && revealedIndex < drawnPrizes.length - 1 ? (
                            <Button 
                                onClick={nextPrize} 
                                className="w-full h-9 font-black bg-primary text-primary-foreground rounded-xl shadow-xl text-sm hover:scale-105 active:scale-95 transition-all"
                            >
                                {drawnPrizes[revealedIndex+1]?.type === 'last-prize' ? '🎉 揭曉最後賞限定！' : `揭曉下一項 (${revealedIndex+1}/${drawnPrizes.length})`}
                            </Button>
                        ) : (step === 'done' || (step === 'revealing' && revealedIndex === drawnPrizes.length - 1)) && (
                            <>
                                <div className="flex gap-2 w-full">
                                    {isLimitReachedForSingle ? (
                                        <Button disabled className="flex-1 h-14 text-sm font-black rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                                            今日次數已用完
                                        </Button>
                                    ) : (
                                        <DrawButtons 
                                            isLoadingStats={isLoadingStats}
                                            isLimitReachedForSingle={isLimitReachedForSingle}
                                            canDraw3={canDraw3}
                                            cardPool={cardPool}
                                            performDraw={performDraw}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Button asChild variant="outline" className="h-10 text-[11px] font-bold border-white/5 rounded-xl bg-white/5 hover:bg-white/10">
                                        <Link href="/draw">返回卡池</Link>
                                    </Button>
                                    
                                    {step === 'done' ? (
                                        <Button asChild variant="outline" className="h-10 text-[11px] font-bold border-primary/40 text-primary rounded-xl bg-primary/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-primary/10">
                                            <Link href="/collection">前往收藏庫</Link>
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={() => setStep('done')} 
                                            variant="outline" 
                                            className="h-10 text-[11px] font-bold border-primary/40 text-primary rounded-xl bg-primary/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-primary/10 animate-pulse"
                                        >
                                            查看本次總結
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center justify-center gap-4 sm:gap-6 [&>button:last-child]:hidden z-[200]">
                    <DialogTitle><VisuallyHiddenPrimitive.Root>卡片預覽</VisuallyHiddenPrimitive.Root></DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-4 sm:gap-6">
                            <h2 className="text-[11px] sm:text-sm font-black text-white text-center px-4 uppercase">{previewCard.name}</h2>
                            <div className="w-[85%] sm:w-full max-w-[360px]">
                                {previewCard.isPoints ? (
                                    <div className={cn("w-full aspect-[2.5/4] rounded-3xl flex flex-col items-center justify-center p-4 border shadow-2xl", pointPrizeRarityStyles[previewCard.rarity as Rarity].bg, pointPrizeRarityStyles[previewCard.rarity as Rarity].border)}>
                                        <PPlusIcon className={cn("w-20 h-20 mb-4", pointPrizeRarityStyles[previewCard.rarity as Rarity].text)} />
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
                    <Button variant="ghost" size="icon" className="mt-2 sm:mt-4 rounded-full bg-black/80 h-10 w-10 sm:h-12 sm:w-12 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}