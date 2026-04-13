import { useState, useMemo, useRef } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Gem, Circle, AlertCircle, ChevronRight } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { CardItem } from '@/components/card-item';
import { useToast } from '@/hooks/use-toast';
import { userLevels } from '@/components/member-level-crown';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';

interface CardData {
    id: string;
    name: string;
    category: string;
    rarity: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    sellPrice?: number;
    isSold?: boolean;
    dailyLimit?: number;
    minLevel?: string;
    isFeatured?: boolean;
}

const DEFAULT_LEVELS = [
    { level: '新手收藏家', threshold: 0 },
    { level: '進階收藏家', threshold: 15000 },
    { level: '資深收藏家', threshold: 50000 },
    { level: '卡牌大師', threshold: 100000 },
    { level: '殿堂級玩家', threshold: 500000 },
    { level: '傳奇收藏家', threshold: 1000000 },
    { level: 'P+卡神', threshold: 2000000 },
];

function calculateLevel(totalSpent: number, benefits?: LevelBenefit[]): string {
    const levels = benefits && benefits.length > 0 ? benefits : DEFAULT_LEVELS;
    const validLevelNames = DEFAULT_LEVELS.map(l => l.level);
    const sorted = [...levels]
        .filter(l => validLevelNames.includes(l.level))
        .sort((a, b) => b.threshold - a.threshold);
    const matched = sorted.find(l => totalSpent >= l.threshold);
    return matched ? matched.level : DEFAULT_LEVELS[0].level;
}

const LeverHeadIcon = ({ className }: { className?: string }) => (
    <div className={cn("relative flex items-center justify-center", className)}>
        <div className="absolute inset-0 bg-destructive rounded-full blur-[4px] opacity-50 animate-pulse" />
        <Circle className="fill-destructive text-white/20 w-full h-full relative z-10" />
    </div>
);

export function BettingGameDialog({ card, children, categoryName, onSpinStart, onClose }: { card: CardData, children: React.ReactNode, categoryName: string, onSpinStart?: () => void, onClose?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSpots, setSelectedSpots] = useState<Set<number>>(new Set());
    const [result, setResult] = useState<{ spot: number; won: boolean } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'p-point'>('diamond');
    const spinnerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const costPerSpot = useMemo(() => {
        if (!card?.sellPrice) return 10;
        const diamondBase = Math.round(card.sellPrice * 0.1);
        return paymentCurrency === 'diamond' ? diamondBase : diamondBase * 10;
    }, [card, paymentCurrency]);

    const totalCost = useMemo(() => selectedSpots.size * costPerSpot, [selectedSpots, costPerSpot]);

    const handleSpin = async () => {
        if (!user || !firestore || !card || selectedSpots.size === 0 || !categoryName || !userProfile) return;
        
        const levelNames = userLevels.map(l => l.level);
        if (levelNames.indexOf(userProfile.userLevel) < (card.minLevel ? levelNames.indexOf(card.minLevel) : 0)) {
            toast({ variant: 'destructive', title: '權限不足', description: `本項目僅限「${card.minLevel}」以上參與。` });
            return;
        }

        if (onSpinStart) onSpinStart(); setIsProcessing(true); setResult(null);
        try {
            const transactionResult = await runTransaction(firestore, async (transaction) => {
                const cardRef = doc(firestore, 'allCards', card.id);
                const cardSnap = await transaction.get(cardRef);
                if (cardSnap.data()?.isSold) throw new Error("此卡片已被贏走，請重新整理後再試。");

                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const walletBalance = paymentCurrency === 'diamond' ? userData.points : userData.bonusPoints;
                if (walletBalance < totalCost) throw new Error("點數不足");
                const winningSpot = Math.floor(Math.random() * 10) + 1;
                const didWin = selectedSpots.has(winningSpot);
                const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
                const updateObj: any = { [walletField]: increment(-totalCost) };
                if (paymentCurrency === 'diamond') {
                    updateObj.totalSpent = increment(totalCost);
                    updateObj.userLevel = calculateLevel(userData.totalSpent + totalCost);
                }
                transaction.update(userRef, updateObj);
                
                const winText = didWin ? 'true' : 'false';
                const detailString = `Bet on ${card.name}. Currency: ${paymentCurrency}. Spots: [${Array.from(selectedSpots).join(',')}]. Result: ${winningSpot}. Win: ${winText}`;
                
                transaction.set(doc(collection(firestore, 'transactions')), { userId: user.uid, targetId: card.id, transactionType: 'Purchase', section: 'betting', currency: paymentCurrency, amount: -totalCost, details: detailString, transactionDate: serverTimestamp() });
                if (didWin) {
                    transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), { 
                        userId: user.uid, 
                        cardId: card.id, 
                        isFoil: true, 
                        rarity: card.rarity || 'unknown', 
                        category: card.category, 
                        source: 'betting' 
                    });
                    transaction.update(doc(firestore, 'allCards', card.id), { isSold: true });
                    transaction.update(doc(firestore, 'betting-items', decodeURIComponent(categoryName)), { soldCardIds: arrayUnion(card.id) });
                }
                return { spot: winningSpot, won: didWin };
            });
            if (spinnerRef.current) {
                const itemH = window.innerWidth < 768 ? 40 : 80;
                const targetPos = -(itemH * 10 * 3 + (transactionResult.spot - 1) * itemH);
                let start: number | null = null;
                const animate = (time: number) => {
                    if (!start) start = time;
                    const progress = Math.min((time - start) / 5000, 1);
                    const eased = 1 - Math.pow(1 - progress, 5);
                    if (spinnerRef.current) spinnerRef.current.style.transform = `translateY(${targetPos * eased}px)`;
                    if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
                    else { setResult(transactionResult); toast({ title: transactionResult.won ? '恭喜中獎！' : '差一點！', variant: transactionResult.won ? 'default' : 'destructive' }); }
                };
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        } catch (e: any) {
            console.error(e);
            toast({ title: '操作失敗', description: e.message, variant: 'destructive' });
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if(!open) { setResult(null); setSelectedSpots(new Set()); setIsProcessing(false); if(onClose) onClose(); } setIsOpen(open); }}>
             <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-[98vw] md:max-w-3xl p-0 overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] bg-slate-900 border-[4px] md:border-[8px] border-slate-950 shadow-2xl h-auto flex flex-col text-white">
                <VisuallyHidden>
                    <DialogTitle>拼卡遊戲</DialogTitle>
                </VisuallyHidden>
                <div className="grid grid-cols-2 h-full">
                    <div className="p-2 md:p-8 bg-black/40 flex flex-col items-center justify-center border-r border-slate-950 relative overflow-hidden">
                        <div className="relative w-full rounded-[1rem] border-[4px] border-slate-950 bg-transparent aspect-[2.5/4] p-2">
                            <CardItem name={card.name} imageUrl={card.imageUrl} backImageUrl={card.backImageUrl} imageHint={card.imageHint} isFlippable={true} rarity="legendary" />
                        </div>
                    </div>
                    <div className="p-3 md:p-6 flex flex-col justify-between bg-slate-950/40 relative">
                        <div className={cn("space-y-4 transition-opacity", isProcessing && "opacity-50 pointer-events-none")}>
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1">
                                    <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm">STEP 01</span> 選擇支付幣別
                                </p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button onClick={() => setPaymentCurrency('diamond')} className={cn("flex flex-col items-center gap-1 p-2 border-2 rounded-xl transition-all", paymentCurrency === 'diamond' ? 'border-primary bg-primary/10' : 'border-slate-950 opacity-40')}><Gem className="w-4 h-4 text-primary"/><span className="text-[10px] font-black">鑽石</span></button>
                                    <button onClick={() => setPaymentCurrency('p-point')} className={cn("flex flex-col items-center gap-1 p-2 border-2 rounded-xl transition-all", paymentCurrency === 'p-point' ? 'border-accent bg-accent/10' : 'border-slate-950 opacity-40')}><PPlusIcon className="w-4 h-4"/><span className="text-[10px] font-black">P+</span></button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-1">
                                    <span className="bg-cyan-400 text-slate-900 px-1.5 py-0.5 rounded-sm">STEP 02</span> 挑選幸運號碼
                                </p>
                                <div className="grid grid-cols-5 gap-1">
                                    {Array.from({length: 10}).map((_, i) => (
                                        <button key={i + 1} onClick={() => { const s = new Set(selectedSpots); if(s.has(i+1)) s.delete(i+1); else s.add(i+1); setSelectedSpots(s); }} className={cn("aspect-square rounded-lg flex items-center justify-center font-black text-xs border-2 transition-all", selectedSpots.has(i+1) ? "bg-destructive text-white border-white/20 shadow-[0_0_10px_rgba(219,39,119,0.4)]" : "bg-slate-950/60 border-slate-950 text-white/40 hover:border-slate-700")}>{i + 1}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-end px-1 pt-1">
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">單注價格</p>
                                    <p className="text-sm font-black font-code flex items-center gap-1 text-white">
                                        {costPerSpot.toLocaleString()} {paymentCurrency === 'diamond' ? <Gem className="w-3 h-3 text-primary"/> : <PPlusIcon className="w-3 h-3 text-accent" />}
                                    </p>
                                </div>
                                <div className="text-right space-y-0.5">
                                    <p className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">下注總計</p>
                                    <p className="text-xl font-black font-code text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                        {totalCost.toLocaleString()} {paymentCurrency === 'diamond' ? '💎' : 'P+'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 pt-2 border-t border-slate-950">
                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] flex items-center gap-1 mb-1">
                                <span className="bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-sm">STEP 03</span> 啟動命運轉輪
                            </p>
                            
                            <div className="relative flex items-center justify-center gap-3">
                                <div className="absolute left-[-12px] md:left-[-20px] z-20 animate-pulse">
                                    <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-rose-500 fill-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                                </div>

                                <div className="relative h-10 md:h-20 w-full overflow-hidden rounded-lg bg-black/90 border-[3px] border-slate-950 shadow-inner flex flex-col items-center">
                                    <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-black via-transparent to-black opacity-80" />
                                    <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />

                                    <div ref={spinnerRef} className="flex flex-col text-sm md:text-5xl font-black font-code text-white transition-transform duration-100">
                                        {Array.from({ length: 5 }).flatMap((_, outer) => Array.from({ length: 10 }).map((_, inner) => (<div key={`${outer}-${inner}`} className="h-10 md:h-20 flex items-center justify-center">{(inner % 10) + 1}</div>)))}
                                    </div>
                                </div>
                            </div>

                            {result ? (
                                <div className="flex flex-col items-center gap-2 mt-2">
                                    <p className={cn("text-lg md:text-6xl font-black font-code", result.won ? "text-amber-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" : "text-white/20")}>{result.spot}</p>
                                    <Button onClick={() => { setResult(null); setSelectedSpots(new Set()); setIsProcessing(false); }} className="w-full h-10 rounded-xl bg-slate-800 text-white text-xs font-bold">再拼一次</Button>
                                </div>
                            ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full h-12 md:h-16 rounded-xl text-xs md:text-xl font-black bg-destructive text-white border-b-4 border-slate-950 active:translate-y-1 active:border-b-0 transition-all mt-2" disabled={isProcessing || selectedSpots.size === 0}>啟動拉霸 <LeverHeadIcon className="w-4 h-4 ml-2" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl bg-slate-950 border-slate-900 border-[6px]">
                                        <AlertDialogHeader><AlertDialogTitle className="font-headline font-black text-destructive text-lg">系統交易確認</AlertDialogTitle></AlertDialogHeader>
                                        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-white/80 space-y-2">
                                            <p className="font-black text-destructive flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> 購買條款：</p>
                                            <ul className="list-none space-y-1 font-bold"><li>● 商品屬機率型，購買即視為參與。</li><li>● 經提供即完成，不適用七日鑑賞期。</li></ul>
                                        </div>
                                        <AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-10 rounded-xl font-bold">取消</AlertDialogCancel><AlertDialogAction onClick={handleSpin} className="h-10 rounded-xl bg-destructive font-black">確認執行</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
