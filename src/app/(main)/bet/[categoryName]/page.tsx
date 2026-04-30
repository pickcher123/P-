'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Gem, ArrowLeft, Search, Loader2, Info, Disc3, Sparkles, XCircle, SearchCode, X, Circle, AlertCircle, Hash, Ban, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { BettingGameDialog } from '@/components/betting-game-dialog';
import { CardItem } from '@/components/card-item';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import { userLevels } from '@/components/member-level-crown';

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
    lockedBy?: string;
    lockedAt?: any;
}

interface BettingCategory {
    id:string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    allCardIds: string[];
    soldCardIds: string[];
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

// BettingGameDialog moved to @/components/betting-game-dialog

function DirectPurchaseDialog({ card, children, categoryName }: { card: CardData, children: React.ReactNode, categoryName: string }) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'p-point'>('diamond');
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const diamondPrice = card.sellPrice || 0;
    const pPointPrice = diamondPrice * 10;

    const handlePurchase = async () => {
        if (!user || !card.sellPrice || !firestore || !userProfile) return;
        const levelNames = userLevels.map(l => l.level);
        if (levelNames.indexOf(userProfile.userLevel) < (card.minLevel ? levelNames.indexOf(card.minLevel) : 0)) {
            toast({ variant: 'destructive', title: '權限不足', description: `僅限「${card.minLevel}」以上購買。` });
            return;
        }
        setIsProcessing(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const cardRef = doc(firestore, 'allCards', card.id);
                const cardSnap = await transaction.get(cardRef);
                const cardData = cardSnap.data();
                if (cardData?.isSold) throw new Error("此卡片已被購買，請重新整理後再試。");
                
                if (cardData?.lockedBy && cardData.lockedBy !== user.uid && cardData.lockedAt && (Date.now() - cardData.lockedAt.toMillis() < 30000)) {
                    throw new Error("此卡片正在被其他人拼，請稍候再試。");
                }

                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const finalPrice = paymentCurrency === 'diamond' ? diamondPrice : pPointPrice;
                const walletBalance = paymentCurrency === 'diamond' ? userData.points : userData.bonusPoints;
                if (walletBalance < finalPrice) throw new Error("點數不足");
                const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
                const updates: any = { [walletField]: increment(-finalPrice) };
                if (paymentCurrency === 'diamond') { updates.totalSpent = increment(finalPrice); updates.userLevel = calculateLevel(userData.totalSpent + finalPrice); }
                transaction.update(userRef, updates);
                transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), { 
                    userId: user.uid, 
                    cardId: card.id, 
                    isFoil: false, 
                    rarity: card.rarity || 'unknown', 
                    category: card.category, 
                    source: 'direct-buy' 
                });
                transaction.update(doc(firestore, 'allCards', card.id), { isSold: true });
                if (decodeURIComponent(categoryName) !== 'all') {
                    transaction.update(doc(firestore, 'betting-items', decodeURIComponent(categoryName)), { soldCardIds: arrayUnion(card.id) });
                }
                transaction.set(doc(collection(firestore, 'transactions')), { userId: user.uid, targetId: card.id, transactionType: 'Purchase', section: 'betting', currency: paymentCurrency, amount: -finalPrice, details: `Direct purchase: ${card.name}`, transactionDate: serverTimestamp() });
            });
            toast({ title: '購買成功！' });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '失敗', description: e.message });
        } finally { setIsProcessing(false); }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent className="max-w-[min(95vw,450px)] rounded-[2rem] bg-slate-900 border-[6px] border-slate-950 text-white">
                <AlertDialogHeader><AlertDialogTitle className="text-center font-black">直接購買確認</AlertDialogTitle></AlertDialogHeader>
                <div className="flex flex-col items-center py-4 space-y-6">
                    <div className="w-32 aspect-[2.5/4] relative rounded-xl overflow-hidden bg-transparent border border-white/10 p-1">
                        <Image src={card.imageUrl} alt={card.name} fill className="object-contain" sizes="128px" />
                    </div>
                    
                    <div className="w-full space-y-3">
                        <p className="text-[10px] font-black uppercase text-primary text-center tracking-widest">選擇支付幣別</p>
                        <RadioGroup value={paymentCurrency} onValueChange={(v: any) => setPaymentCurrency(v)} className="w-full grid grid-cols-2 gap-3">
                            <div onClick={() => setPaymentCurrency('diamond')} className={cn("p-3 border-2 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center", paymentCurrency === 'diamond' ? 'border-primary bg-primary/10' : 'border-slate-950 opacity-40')}>
                                <Gem className="w-6 h-6 mb-1 text-primary"/>
                                <span className="text-[10px] font-black">鑽石</span>
                                <p className="text-sm font-black font-code mt-1">{diamondPrice.toLocaleString()} 💎</p>
                            </div>
                            <div onClick={() => setPaymentCurrency('p-point')} className={cn("p-3 border-2 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center", paymentCurrency === 'p-point' ? 'border-accent bg-accent/10' : 'border-slate-950 opacity-40')}>
                                <PPlusIcon className="w-6 h-6 mb-1 text-accent"/>
                                <span className="text-[10px] font-black">P+</span>
                                <p className="text-sm font-black font-code mt-1 text-accent">{pPointPrice.toLocaleString()} P+</p>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="h-10 rounded-xl font-bold bg-white/5 border-white/10 text-white hover:bg-white/10">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePurchase} disabled={isProcessing} className="h-10 rounded-xl bg-destructive font-black">確認訂購</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function BetCategoryPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const categoryName = params.categoryName as string;
    console.log('categoryName:', categoryName);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<'price-high' | 'price-low' | 'latest' | 'unsold'>('latest');
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);
    
    const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'bettingCategories') : null, [firestore]);
    const { data: categories } = useCollection<BettingCategory>(categoriesQuery);
    
    const bettingItemsRef = useMemoFirebase(() => (firestore && categoryName) ? doc(firestore, 'betting-items', decodeURIComponent(categoryName)) : null, [firestore, categoryName]);
    const { data: bettingItems } = useDoc<BettingItems>(bettingItemsRef);
    console.log('bettingItems:', bettingItems);
    
    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoading} = useCollection<CardData>(allCardsCollectionRef);
    
    const soldCardIds = useMemo(() => new Set(bettingItems?.soldCardIds || []), [bettingItems]);

    const filteredCards = useMemo(() => {
        if (!allCards || !bettingItems?.allCardIds) return [];
        const cardIdSet = new Set(bettingItems.allCardIds);
        let baseCards = allCards.filter(c => cardIdSet.has(c.id));
        
        // Search
        if (searchTerm.trim()) {
            baseCards = baseCards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        
        // Sorting
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
    }, [allCards, bettingItems, searchTerm, sortOption, soldCardIds]);
    
    const soldCardIds = useMemo(() => new Set(bettingItems?.soldCardIds || []), [bettingItems]);

    return (
        <div className="container py-8 relative text-white">
            <div className="text-center mb-8 space-y-4">
                <div className="flex items-center justify-center gap-3"><h1 className="font-headline text-3xl font-black tracking-widest sm:text-6xl text-white">拼卡專區</h1></div>
            </div>
            
            {/* 右上角遊戲規則按鈕 */}
            <div className="absolute top-4 right-4 md:top-10 md:right-10 z-30">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto px-0 md:px-4 rounded-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-destructive/10 hover:border-destructive/30 text-white font-bold transition-all gap-2">
                            <Info className="h-4 w-4 text-destructive" />
                            <span className="text-xs uppercase tracking-widest hidden md:inline">遊戲規則</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-destructive/20 shadow-2xl max-w-6xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black font-headline text-destructive italic tracking-tighter">CASINO RULES</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 text-sm text-white/80 leading-relaxed py-2">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                                    <p className="flex items-start gap-2 text-xs"><span className="text-destructive font-black font-code text-sm">01.</span> 「拼卡」是一種 1/10 中獎機率的遊戲。</p>
                                </div>
                                <div className="p-3 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                                    <p className="flex items-start gap-2 text-xs"><span className="text-destructive font-black font-code text-sm">02.</span> 玩家可以選擇使用「鑽石」或「紅利 P+ 點」支付。</p>
                                </div>
                                <div className="p-3 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                                    <p className="flex items-start gap-2 text-xs"><span className="text-destructive font-black font-code text-sm">03.</span> <span className="text-accent font-bold underline underline-offset-4 mr-1">鑽石與 P+ 點比例為 1:10</span>。</p>
                                </div>
                                <div className="p-3 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                                    <p className="flex items-start gap-2 text-xs"><span className="text-destructive font-black font-code text-sm">04.</span> 確認下注後，系統將隨機抽出一個幸運號碼。若匹配，您就贏得了該張卡片！</p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="mb-4 flex items-center justify-between animate-fade-in-up px-4 md:px-8">
                <h2 className="flex items-center text-sm md:text-lg font-bold font-headline text-white tracking-widest text-left">
                    <span className="flex items-center"><Disc3 className="w-4 h-4 md:w-5 md:h-5 mr-3 text-primary animate-spin-slow shrink-0" />全部卡片</span>
                </h2>
                <div className="flex items-center gap-2">
                     <span className="text-xs text-white/50">排序:</span>
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
            </div>
            
            <div className="px-4 md:px-8 mb-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="搜尋獎品名稱..." 
                        className="pl-10 h-12 bg-background/40 rounded-xl border-white/10" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[2.5/4] rounded-[2rem]" />) : 
                filteredCards.map((card) => {
                    const isSold = soldCardIds.has(card.id) || card.isSold;
                    return (
                        <div key={card.id} className="relative flex flex-col p-3 bg-slate-900 border-[6px] border-slate-950 rounded-[1.5rem] shadow-xl min-h-[420px] group transition-all hover:-translate-y-2">
                            {card.isFeatured && (
                                <div className="absolute -top-2 -left-2 z-20 rotate-[-15deg]">
                                    <div className="bg-accent text-accent-foreground font-black text-[10px] px-3 py-1 rounded-full shadow-lg border border-white/20 uppercase tracking-widest">
                                        精選
                                    </div>
                                </div>
                            )}
                            <div className="relative flex-1 bg-black/90 rounded-[1rem] border-[6px] border-slate-950 overflow-hidden p-4 group-hover:border-primary/20 transition-colors">
                                <div className={cn("w-full aspect-[2.5/4] relative cursor-zoom-in transition-all duration-500", isSold && "grayscale opacity-20 scale-95")} onClick={() => !isSold && setPreviewCard(card)}>
                                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-[9px] font-black tracking-widest text-primary px-2 py-0.5 rounded-lg border border-primary/20 pointer-events-none z-20">
                                        {card.sellPrice ? `${card.sellPrice}💎` : 'N/A'}
                                    </div>
                                    <Image src={card.imageUrl} alt={card.name} fill className="object-contain" sizes="(max-width: 768px) 50vw, 25vw" />
                                </div>
                                {isSold && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
                                        <div className="relative z-10 flex flex-col items-center gap-3">
                                            <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                                <XCircle className="w-8 h-8" />
                                            </div>
                                            <Badge className="bg-destructive text-white font-black px-4 py-1.5 rotate-[-12deg] uppercase tracking-tighter text-sm shadow-[0_5px_15px_rgba(239,68,68,0.4)] border-none">
                                                已被抽出
                                            </Badge>
                                            <p className="text-[10px] font-black text-destructive/60 uppercase tracking-[0.2em] mt-2">Drawn Out</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {card.minLevel && card.minLevel !== '新手收藏家' && <Badge variant="outline" className="text-[7px] border-primary/30 text-primary uppercase">{card.minLevel} 限定</Badge>}
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {isSold ? <Button variant="outline" disabled className="w-full h-9 rounded-xl opacity-50 font-bold">已被抽出</Button> : (
                                        <><BettingGameDialog card={card} categoryName={categoryName} onSpinStart={()=>{}} onClose={()=>{}}><Button className="w-full h-9 font-black rounded-xl bg-destructive text-white border-b-4 border-slate-950 flex justify-between px-3 active:translate-y-1 active:border-b-0 transition-all"><span className="text-[8px] uppercase font-headline">JACKPOT</span><span className="flex-1 text-center">拼手氣</span><LeverHeadIcon className="w-4 h-4" /></Button></BettingGameDialog>
                                        <DirectPurchaseDialog card={card} categoryName={categoryName}><Button variant="outline" className="w-full h-9 font-black rounded-xl bg-white/5 border-white/10 border-b-4 border-slate-950 flex justify-between px-3 active:translate-y-1 active:border-b-0 transition-all hover:bg-white/10"><span className="text-[8px] uppercase font-headline">BUY</span><span className="flex-1 text-center">直接購買</span><Gem className="w-4 h-4 text-primary" /></Button></DirectPurchaseDialog></>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-12 text-center opacity-20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.5em]">P+Carder Authentic Platform</p>
            </div>
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-6">
                            <h2 className="text-sm font-black text-white text-center px-6">{previewCard.name}</h2>
                            <div className="w-full max-w-[300px] relative">
                                <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity="legendary" isFlippable={true}/>
                            </div>
                            <p className="text-[9px] text-destructive font-bold uppercase animate-pulse">點擊翻轉</p>
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="mt-4 rounded-full bg-black/60 h-12 w-12 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-6 w-6" />
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}
