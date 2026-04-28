'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection, query, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Gem, Loader2, Trophy, X, Dices, Users, Info, HelpCircle, CheckCircle2 } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { CardItem } from '@/components/card-item';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { LuckBagWithCount, CardData } from '@/app/(main)/lucky-bags/page';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';

interface LuckBagPurchase {
  id: string;
  userId: string;
  username?: string;
  luckBagId: string;
  spotNumber: number;
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
    const sorted = [...levels].sort((a, b) => b.threshold - a.threshold);
    const matched = sorted.find(l => totalSpent >= l.threshold);
    return matched ? matched.level : DEFAULT_LEVELS[0].level;
}

const PrizeDisplayCard = ({ card, levelText, onPreview }: { card?: CardData, levelText: string, onPreview: (card: CardData) => void }) => {
    if (!card) return (
        <div className="p-4 bg-black/5 rounded-lg border border-dashed h-full flex flex-col items-center justify-center opacity-40">
            <Trophy className="w-8 h-8 mb-2"/>
            <p className="text-[10px] font-black">{levelText}</p>
        </div>
    );
    return (
        <div className="relative group/prize animate-fade-in-up cursor-zoom-in" onClick={() => onPreview(card)}>
            <div className="transition-all duration-500 hover:scale-105">
                <CardItem name={card.name} imageUrl={card.imageUrl} backImageUrl={card.backImageUrl} imageHint={card.name} isFlippable={false} />
            </div>
             <div className="mt-2 text-center text-slate-900">
                <p className="font-black text-[8px] uppercase text-slate-500 tracking-[0.1em]">{levelText}</p>
                <p className="font-bold text-[10px] truncate text-slate-900">{card.name}</p>
            </div>
        </div>
    );
};

export function LuckBagDetailView({ luckBag }: { luckBag: LuckBagWithCount }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedSpots, setSelectedSpots] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);
    
    // 隨機選號狀態
    const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
    const [randomPickCount, setRandomPickCount] = useState(1);
    
    // 參與名單狀態
    const [isListOpen, setIsListOpen] = useState(false);

    const purchasesQuery = useMemoFirebase(() => 
        (firestore && luckBag.id) ? collection(firestore, 'luckBags', luckBag.id, 'luckBagPurchases') : null, 
        [firestore, luckBag.id]
    );
    const { data: purchases, forceRefetch } = useCollection<LuckBagPurchase>(purchasesQuery);
    
    const { takenSpots, participantCount } = useMemo(() => {
        const spotSet = new Set<number>();
        const mineSet = new Set<number>();
        purchases?.forEach(p => { 
            spotSet.add(p.spotNumber); 
            if (p.userId === user?.uid) mineSet.add(p.spotNumber); 
        });
        return { takenSpots: { all: spotSet, mine: mineSet }, participantCount: spotSet.size };
    }, [purchases, user]);

    const handleSpotClick = (spot: number) => {
        if (isCompleted) return;
        setSelectedSpots(prev => {
            const next = new Set(prev);
            if (next.has(spot)) next.delete(spot);
            else next.add(spot);
            return next;
        });
    };

    const handleRandomPick = () => {
        const available = [];
        for (let i = 1; i <= luckBag.totalParticipants; i++) {
            if (!takenSpots.all.has(i) && !selectedSpots.has(i)) {
                available.push(i);
            }
        }

        if (available.length < randomPickCount) {
            toast({ variant: 'destructive', title: '名額不足', description: `剩餘可用位置僅剩 ${available.length} 個。` });
            return;
        }

        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, randomPickCount);
        
        setSelectedSpots(prev => {
            const next = new Set(prev);
            picked.forEach(s => next.add(s));
            return next;
        });
        setIsRandomPickOpen(false);
        toast({ title: `已隨機選取 ${randomPickCount} 個號碼` });
    };

    const handlePurchase = async () => {
        if (!user || !firestore || selectedSpots.size === 0) return;
        setIsSubmitting(true);
        const currency = luckBag.currency || 'p-point';
        try {
             await runTransaction(firestore, async (transaction) => {
                const totalCost = selectedSpots.size * (luckBag.price || 0);
                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const walletBalance = currency === 'diamond' ? userData.points : userData.bonusPoints;
                
                if (walletBalance < totalCost) throw new Error("點數餘額不足");
                
                const purchasesRef = collection(firestore, 'luckBags', luckBag.id, 'luckBagPurchases');
                
                // Check if any spot is already taken
                for (const spot of selectedSpots) {
                    const spotRef = doc(purchasesRef, spot.toString());
                    const spotSnap = await transaction.get(spotRef);
                    if (spotSnap.exists()) {
                        throw new Error(`號碼 ${spot} 已經被選走了，請重新選擇`);
                    }
                }

                for (const spot of selectedSpots) {
                    transaction.set(doc(purchasesRef, spot.toString()), { 
                        userId: user.uid, 
                        username: userData.username,
                        luckBagId: luckBag.id, 
                        spotNumber: spot, 
                        purchasedAt: serverTimestamp() 
                    });
                }
                
                const walletField = currency === 'diamond' ? 'points' : 'bonusPoints';
                const updates: any = { [walletField]: increment(-totalCost) };
                if (currency === 'diamond') { 
                    updates.totalSpent = increment(totalCost); 
                    updates.userLevel = calculateLevel(userData.totalSpent + totalCost); 
                }
                transaction.update(userRef, updates);
                transaction.set(doc(collection(firestore, 'transactions')), { 
                    userId: user.uid, 
                    transactionType: 'Purchase', 
                    section: 'lucky-bag', 
                    currency, 
                    amount: -totalCost, 
                    details: `購買福袋格: ${luckBag.name}`, 
                    transactionDate: serverTimestamp() 
                });
            });
            if (forceRefetch) forceRefetch();
            toast({ title: '購買成功！' });
            setSelectedSpots(new Set());
            setIsConfirming(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: '失敗', description: error.message }); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
    
    const isCompleted = luckBag.status === '已開獎';
    const currency = luckBag.currency || 'p-point';
    const progress = (participantCount / (luckBag.totalParticipants || 1)) * 100;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 relative bg-slate-200">
            {/* 左側獎項展示區 */}
            <div className="p-4 md:p-10 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-slate-400">
                <div className="relative w-full aspect-[4/5] bg-slate-600 rounded-2xl p-4 md:p-6 shadow-inner flex flex-col">
                    <div className="relative flex-1 flex flex-col bg-[#f0f4f7] rounded-sm overflow-hidden p-4 md:p-6 border-4 border-[#ccd6d9]">
                        <div className="mb-4 md:mb-6">
                            <h1 className="font-headline text-base md:text-lg font-black text-slate-900 uppercase">{luckBag.name}</h1>
                            <div className="flex items-center gap-1 mt-1 md:mt-2">
                                {currency === 'p-point' ? <PPlusIcon className="w-4 h-4 md:w-5 md:h-5" /> : <Gem className="w-4 h-4 md:w-5 md:h-5 text-primary" />}
                                <p className="font-black text-xl md:text-2xl text-accent font-code">{(luckBag.price || 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="space-y-4 md:space-y-6 flex-1 flex flex-col justify-between">
                            <div className="grid grid-cols-3 gap-3 md:gap-4">
                                {luckBag.prizeCards.first && <PrizeDisplayCard card={luckBag.prizeCards.first} levelText="頭獎" onPreview={setPreviewCard} />}
                                {luckBag.prizeCards.second && <PrizeDisplayCard card={luckBag.prizeCards.second} levelText="2 獎" onPreview={setPreviewCard} />}
                                {luckBag.prizeCards.third && <PrizeDisplayCard card={luckBag.prizeCards.third} levelText="3 獎" onPreview={setPreviewCard} />}
                                {[...luckBag.otherPrizesList, ...luckBag.otherPointsList.map(p => ({ ...p, isPoints: true }))].slice(0, 3).map((prize, index) => (
                                    'isPoints' in prize ? (
                                        <div key={prize.prizeId} className="flex flex-col items-center">
                                            <div className="p-4 bg-white rounded-lg border h-full flex flex-col items-center justify-center w-full aspect-[4/5]">
                                                <PPlusIcon className="w-12 h-12 text-accent" />
                                            </div>
                                            <div className="mt-2 text-center text-slate-900">
                                                <p className="font-black text-[8px] uppercase text-slate-500 tracking-[0.1em]">{index + 4} 獎</p>
                                                <p className="font-bold text-[10px] truncate text-slate-900">{prize.points} 點數</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <PrizeDisplayCard 
                                            key={prize.prizeId} 
                                            card={prize} 
                                            levelText={`${index + 4} 獎`} 
                                            onPreview={setPreviewCard} 
                                        />
                                    )
                                ))}
                            </div>
                            
                            {/* 其他獎項按鈕 */}
                            {(luckBag.otherPrizesList && luckBag.otherPrizesList.length > 0 || luckBag.otherPointsList && luckBag.otherPointsList.length > 0) && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <div className="col-span-3 p-4 bg-slate-800 rounded-lg border flex items-center justify-center gap-3 cursor-pointer hover:bg-slate-900 transition-colors mt-2">
                                            <Trophy className="w-6 h-6 text-white" />
                                            <p className="text-sm font-black text-white">查看其他獎項</p>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md bg-slate-200 border-slate-400">
                                        <DialogHeader>
                                            <DialogTitle>完整獎項列表</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[60vh]">
                                            <div className="space-y-2">
                                                {[...luckBag.otherPrizesList, ...luckBag.otherPointsList.map(p => ({ ...p, isPoints: true }))].slice(3).map((prize, index) => (
                                                    <div key={prize.prizeId} className="p-3 bg-white rounded-lg border flex items-center justify-between">
                                                        <span className="font-bold text-sm text-slate-900">{index + 7} 獎</span>
                                                        <span className="font-bold text-sm text-slate-900">{'isPoints' in prize ? `${prize.points} 點數` : prize.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            )}
                            
                            <div className="p-3 md:p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2 md:gap-3">
                                <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-500 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 md:space-y-1">
                                    <p className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest">選號解釋與說明</p>
                                    <p className="text-[10px] md:text-[11px] font-bold text-slate-600 leading-tight md:leading-relaxed">
                                        挑選尚未被佔用的號碼。售罄後系統將依照直播結果派獎。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 右側選號互動區 */}
            <div className="p-4 md:p-10 flex flex-col bg-slate-200 text-slate-900">
                {!isCompleted ? (
                    <>
                        <div className="mb-4 md:mb-6 flex flex-col gap-3 md:gap-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-0.5 md:space-y-1">
                                    <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-500">募集當前進度</p>
                                    <p className="text-lg md:text-xl font-black font-code">{participantCount} / {luckBag.totalParticipants}</p>
                                </div>
                                <div className="flex gap-1.5 md:gap-2">
                                    <Button variant="outline" size="sm" className="bg-slate-300 border-none text-slate-700 font-bold h-8 md:h-9 text-[10px] md:text-sm px-2.5 md:px-4" onClick={() => setIsListOpen(true)}>
                                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" /> 名單
                                    </Button>
                                    <Button variant="outline" size="sm" className="bg-slate-300 border-none text-slate-700 font-bold h-8 md:h-9 text-[10px] md:text-sm px-2.5 md:px-4" onClick={() => setIsRandomPickOpen(true)}>
                                        <Dices className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1" /> 隨機
                                    </Button>
                                </div>
                            </div>
                            <div className="h-2.5 md:h-3 w-full bg-slate-300 rounded-full overflow-hidden border-2 border-slate-400 shadow-inner">
                                <div className="h-full bg-slate-800 transition-all duration-1000" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        <ScrollArea className="flex-grow h-[300px] md:h-[400px] border-4 border-slate-400 bg-slate-300 rounded-xl p-2 md:p-3 shadow-inner">
                            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 md:gap-2 p-2 md:p-3">
                                {Array.from({ length: luckBag.totalParticipants || 0 }).map((_, i) => { 
                                    const spot = i + 1; 
                                    const taken = takenSpots.all.has(spot); 
                                    return (
                                        <button 
                                            key={spot} 
                                            disabled={taken}
                                            onClick={() => handleSpotClick(spot)} 
                                            className={cn(
                                                "aspect-square rounded-full flex items-center justify-center font-black text-[10px] md:text-xs transition-all border-2", 
                                                taken ? "bg-black/10 text-black/20 border-transparent opacity-40" : 
                                                selectedSpots.has(spot) ? "bg-slate-800 text-white border-black scale-110 shadow-lg" : 
                                                "bg-slate-100 border-slate-400 text-slate-800 hover:border-slate-800"
                                            )}
                                        >
                                            <span className="font-code">{spot}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>

                        {luckBag.revealLottery ? (
                            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-slate-400 flex flex-col items-center justify-center text-center">
                                <p className="text-lg md:text-xl font-black text-accent uppercase tracking-widest animate-pulse">直播開獎中</p>
                                <p className="text-xs md:text-sm font-bold text-slate-500 mt-2">管理員正在進行開獎作業，請稍候...</p>
                            </div>
                        ) : participantCount >= (luckBag.totalParticipants || 1) ? (
                            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-slate-400 flex flex-col items-center justify-center text-center">
                                <p className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-widest">已滿編，等待直播開獎</p>
                                <p className="text-xs md:text-sm font-bold text-slate-500 mt-2">請留意官方直播時間，系統將於直播後派發獎項。</p>
                            </div>
                        ) : (
                            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-slate-400 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 md:gap-0">
                                <div className="w-full sm:w-auto text-center sm:text-left">
                                    <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase">預計支付金額</p>
                                    <div className="flex items-center justify-center sm:justify-start gap-1.5 md:gap-2 text-3xl md:text-4xl font-black font-code text-accent">
                                        {(selectedSpots.size * (luckBag.price || 0)).toLocaleString()}
                                        {currency === 'diamond' ? <Gem className="w-6 h-6 md:w-8 md:h-8 text-primary" /> : <PPlusIcon className="w-6 h-6 md:w-8 md:h-8" />}
                                    </div>
                                </div>
                                <Button className="w-full sm:w-auto h-14 md:h-16 rounded-2xl px-8 md:px-10 font-black bg-slate-800 text-white hover:bg-slate-950 shadow-xl transition-all active:scale-95 text-base md:text-lg" disabled={selectedSpots.size === 0 || isSubmitting} onClick={() => setIsConfirming(true)}>
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : '確認購買並鎖定'}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 md:space-y-10">
                        <Trophy className="w-16 h-16 md:w-24 md:h-24 text-slate-800" />
                        <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest italic">福袋募集完成：已開獎</h2>
                        {luckBag.winners && (
                            <div className="w-full p-6 md:p-8 bg-slate-100 border-b-[8px] border-r-[8px] border-slate-300 rounded-3xl space-y-2 md:space-y-4">
                                <span className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">幸運頭獎序號</span>
                                <p className="text-5xl md:text-7xl font-black font-code text-slate-900 drop-shadow-sm"># {luckBag.winners.first}</p>
                                <p className="text-xs md:text-sm font-bold text-primary">得獎玩家：{purchases?.find(p => p.spotNumber === luckBag.winners?.first)?.username || '載入中...'}</p>
                            </div>
                        )}
                        <Button variant="outline" className="rounded-xl border-slate-400 text-slate-600 font-bold" onClick={() => setIsListOpen(true)}>
                            查看完整開獎對照表
                        </Button>
                    </div>
                )}
            </div>
            
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center justify-center gap-4 sm:gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-6 sm:gap-8 pt-4">
                            <h2 className="text-base sm:text-lg font-black text-white text-center px-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{previewCard.name}</h2>
                            <div className="w-[80%] sm:w-full max-w-[320px]">
                                <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity="legendary" isFlippable={true}/>
                            </div>
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="mt-2 sm:mt-4 rounded-full bg-black/80 h-10 w-10 sm:h-12 sm:w-12 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </DialogContent>
            </Dialog>

            {/* 隨機選號 Dialog */}
            <Dialog open={isRandomPickOpen} onOpenChange={setIsRandomPickOpen}>
                <DialogContent className="max-w-[min(95vw,340px)] sm:max-w-xs rounded-[2rem] md:rounded-[2.5rem] bg-slate-200 border-slate-400 border-[6px] md:border-[10px] p-6 md:p-8 text-slate-900">
                    <DialogTitle className="font-headline font-black text-xl tracking-tighter italic uppercase text-slate-900">電腦隨機選號</DialogTitle>
                    <DialogHeader>
                        <DialogDescription className="text-slate-600 font-bold text-xs mt-1">請輸入您想要自動選取的福袋格數。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 md:py-6">
                        <Label className="text-[10px] font-black uppercase text-slate-500 mb-2 block text-center">購買格數</Label>
                        <Input 
                            type="number" 
                            min={1} 
                            max={luckBag.totalParticipants} 
                            value={randomPickCount} 
                            onChange={(e) => setRandomPickCount(Number(e.target.value))} 
                            className="h-14 md:h-16 bg-black/10 border-none rounded-2xl font-code text-3xl md:text-4xl font-black text-center text-slate-900"
                        />
                    </div>
                    <DialogFooter className="sm:flex-col gap-2">
                        <Button onClick={handleRandomPick} className="w-full h-12 md:h-14 font-black rounded-2xl bg-slate-800 text-white shadow-xl">執行隨機分配</Button>
                        <Button variant="ghost" onClick={() => setIsRandomPickOpen(false)} className="w-full h-10 font-bold text-slate-600">取消</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 參與名單/開獎名單 Dialog */}
            <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
                <DialogContent className="max-w-4xl h-[85vh] sm:h-auto sm:max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden bg-slate-200 border-slate-400 border-[6px] md:border-[10px] rounded-[2rem] md:rounded-[2.5rem] text-slate-900">
                    <DialogHeader className="p-6 md:p-8 bg-slate-300/50 border-b border-slate-400 shrink-0">
                        <DialogTitle className="font-headline font-black text-xl md:text-2xl italic uppercase flex items-center gap-2 md:gap-3">
                            <Users className="w-6 h-6 md:w-8 md:h-8 text-slate-800" /> 參與藏友名單
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-bold text-xs md:text-sm">全站透明公示：查看所有序號的即時持有狀態。</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-200 shadow-inner overscroll-contain">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                            {Array.from({ length: luckBag.totalParticipants }).map((_, i) => {
                                const spotNum = i + 1;
                                const p = purchases?.find(x => x.spotNumber === spotNum);
                                const winner = luckBag.winners && (
                                    luckBag.winners.first === spotNum ? '頭獎' :
                                    luckBag.winners.second === spotNum ? '貳獎' :
                                    luckBag.winners.third === spotNum ? '叁獎' :
                                    luckBag.winners.other?.some(o => o.spotNumber === spotNum) ? '普獎' : null
                                );

                                return (
                                    <div 
                                        key={spotNum} 
                                        className={cn(
                                            "flex flex-col p-2.5 md:p-3 rounded-2xl border-2 transition-all group",
                                            winner ? "bg-accent/10 border-accent/40 shadow-lg shadow-accent/5 ring-1 ring-accent/20" : 
                                            p ? "bg-white/40 border-slate-300" : "bg-slate-300/30 border-dashed border-slate-400 opacity-60"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn("font-code font-black text-base md:text-lg", winner ? "text-accent" : "text-slate-500")}>#{spotNum}</span>
                                            {winner && <Badge className="bg-accent text-accent-foreground font-black text-[7px] md:text-[8px] h-4 md:h-5 px-1 md:px-1.5 border-none uppercase">{winner}</Badge>}
                                        </div>
                                        <div className="truncate">
                                            {p ? (
                                                <p className="font-bold text-[10px] md:text-xs text-slate-800 truncate">{p.username || '已購買'}</p>
                                            ) : (
                                                <p className="text-[9px] md:text-[10px] text-slate-400 font-medium italic">待藏家入駐</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 md:p-6 border-t border-slate-400 bg-slate-300/50 shrink-0">
                        <Button onClick={() => setIsListOpen(false)} className="w-full h-12 md:h-14 rounded-2xl font-black bg-slate-800 text-white shadow-xl hover:bg-slate-950 transition-all">
                            關閉名單視窗
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 交易確認 Dialog */}
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="max-w-[min(95vw,400px)] rounded-[2rem] bg-slate-200 border-slate-400 border-[6px] md:border-[10px] text-slate-900">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black italic text-xl md:text-2xl uppercase tracking-tighter">系統交易確認</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-slate-600 font-bold space-y-3 md:space-y-4">
                                <p className="text-sm md:text-base">確定要支付 {(selectedSpots.size * (luckBag.price || 0)).toLocaleString()} {currency === 'diamond' ? '鑽石' : 'P+'} 購買所選的 {selectedSpots.size} 個位置嗎？</p>
                                <div className="p-3 md:p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left text-[10px] md:text-[11px] leading-tight md:leading-relaxed space-y-1 md:space-y-1.5">
                                    <p className="font-black text-destructive flex items-center gap-2"><HelpCircle className="w-3.5 h-3.5" /> 購買守則提示：</p>
                                    <ul className="list-none pl-0 space-y-1 font-bold">
                                        <li>● 福袋屬機率型商品，購買後不可要求退換貨。</li>
                                        <li>● 募集完成後系統將進行開獎，獎品將直接發放至您的「收藏庫」。</li>
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-2 md:mt-4">
                        <AlertDialogCancel className="h-12 md:h-14 rounded-xl font-black bg-slate-400 border-none text-white flex-1">考慮一下</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePurchase} disabled={isSubmitting} className="h-12 md:h-14 rounded-xl font-black bg-slate-800 text-white shadow-xl flex-1">確認購買</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}