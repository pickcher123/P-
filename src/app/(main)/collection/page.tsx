'use client';
import { useState, useMemo, useEffect } from 'react';
import { CardItem } from '@/components/card-item';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from '@/components/ui/checkbox';
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Ship, RefreshCw, Gem, Loader2, CheckSquare, Square, Shield, LayoutGrid, Users, Users2, MapPin, SearchCode, X, Sparkles, ChevronRight, Package, Library, Hash, Info, AlertTriangle, RotateCcw } from 'lucide-react';
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, increment, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

type Rarity = 'common' | 'rare' | 'legendary';
type ShippingMethod = '7-11' | '郵寄' | '面交自取';

interface UserCard {
    id: string;
    cardId: string;
    isFoil: boolean;
    userId: string;
    category: string;
    rarity: Rarity;
    source?: string;
    breakTitle?: string;
    teamName?: string;
}

interface AllCards {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    sellPrice?: number;
    isSold?: boolean;
}

type MergedCard = UserCard & AllCards & { serialNumber: string };

const SHIPPING_FEE = 60;
const PICKUP_ADDRESS = "台北市中山區林森北路50號3樓之4";

export default function CollectionPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCard, setPreviewCard] = useState<MergedCard | null>(null);
  
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('7-11');
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  useEffect(() => {
    if (userProfile) {
      setShippingName(userProfile.realName || userProfile.username || '');
      setShippingPhone(userProfile.phone || '');
      setShippingAddress(userProfile.address || '');
    }
  }, [userProfile]);

  const { data: userCards, isLoading: isLoadingUserCards, forceRefetch } = useCollection<UserCard>(
    useMemoFirebase(() => (firestore && user?.uid) ? collection(firestore, 'users', user.uid, 'userCards') : null, [firestore, user?.uid])
  );

  const { data: allCards, isLoading: isLoadingCards } = useCollection<AllCards>(
    useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore])
  );
  
  const mergedCards: MergedCard[] = useMemo(() => {
    if (!userCards || !allCards) return [];
    const cardMap = new Map(allCards.map(c => [c.id, c]));
    return userCards.map(userCard => {
      const cardDetails = cardMap.get(userCard.cardId);
      if (cardDetails) {
        return {
          ...cardDetails,
          ...userCard,
          serialNumber: userCard.serialNumber || '0000'
        }
      }
      return null;
    }).filter((c): c is MergedCard => c !== null);
  }, [userCards, allCards]);

  const standardCards = useMemo(() => mergedCards.filter(c => c.source !== 'group-break'), [mergedCards]);
  const groupBreakCards = useMemo(() => mergedCards.filter(c => c.source === 'group-break'), [mergedCards]);

  const hasFreeShipping = useMemo(() => {
      if (!userProfile || !systemConfig?.levelBenefits) return false;
      const benefit = systemConfig.levelBenefits.find(b => b.level === userProfile.userLevel);
      return benefit?.freeShipping || false;
  }, [userProfile, systemConfig]);

  const handleSelectCard = (userCardId: string, isSelected: boolean | 'indeterminate') => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) newSet.add(userCardId);
      else newSet.delete(userCardId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCardIds.size === mergedCards.length) {
        setSelectedCardIds(new Set());
    } else {
        setSelectedCardIds(new Set(mergedCards.map(card => card.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedCardIds(new Set());
  };

  const conversionValues = useMemo(() => {
    const cardsToSell = mergedCards.filter(c => selectedCardIds.has(c.id) && c.source !== 'group-break');
    let diamonds = 0;
    let pPoints = 0;
    
    cardsToSell.forEach(card => {
        const basePrice = card.sellPrice || 10;
        diamonds += basePrice * 0.7;
        pPoints += basePrice * 0.1 * 10; 
    });

    return {
        diamonds: Math.round(diamonds),
        pPoints: Math.round(pPoints)
    };
  }, [mergedCards, selectedCardIds]);

  const handleQuickSell = async () => {
    if (selectedCardIds.size === 0 || !user || !firestore) return;
    const cardsToSell = mergedCards.filter(c => selectedCardIds.has(c.id) && c.source !== 'group-break');
    if (cardsToSell.length === 0) {
        toast({ variant: "destructive", title: "轉點失敗", description: "所選項目均為團拆限定，無法進行轉點。" });
        return;
    }
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const { diamonds, pPoints } = conversionValues;
      const soldCardNames = cardsToSell.map(c => c.name).join(', ');

      for (const card of cardsToSell) {
        batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
        batch.update(doc(firestore, 'allCards', card.cardId), { isSold: true });
      }

      batch.set(doc(collection(firestore, 'transactions')), {
        userId: user.uid,
        transactionType: 'QuickSell',
        currency: 'diamond',
        amount: diamonds,
        details: `快速轉點 ${cardsToSell.length} 張卡片 (獲得鑽石)。卡片內容: [${soldCardNames}]`,
        transactionDate: serverTimestamp(),
        section: 'admin'
      });

      if (pPoints > 0) {
          batch.set(doc(collection(firestore, 'transactions')), {
            userId: user.uid,
            transactionType: 'QuickSell',
            currency: 'p-point',
            amount: pPoints,
            details: `快速轉點 ${cardsToSell.length} 張卡片 (獲得紅利P點)。卡片內容: [${soldCardNames}]`,
            transactionDate: serverTimestamp(),
            section: 'admin'
          });
      }

      batch.update(doc(firestore, 'users', user.uid), { 
          points: increment(diamonds),
          bonusPoints: increment(pPoints)
      });

      await batch.commit();
      toast({ title: "快速轉點成功！", description: `已將卡片資產轉換為 ${diamonds} 💎 與 ${pPoints} P點。` });
      setSelectedCardIds(new Set());
      if(forceRefetch) forceRefetch();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "轉點失敗", description: "處理請求時發生錯誤。" });
    } finally { setIsProcessing(false); }
  };

  const handleShipping = async () => {
    const finalAddress = shippingMethod === '面交自取' ? `${PICKUP_ADDRESS} (自取)` : shippingAddress;

    if (selectedCardIds.size === 0 || !user || !firestore || !finalAddress || !shippingName || !shippingPhone) {
        toast({ variant: 'destructive', title: '錯誤', description: '所有資訊皆為必填。'});
        return;
    }
    setIsProcessing(true);
    const fee = (shippingMethod === '面交自取' || hasFreeShipping) ? 0 : SHIPPING_FEE;
    try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (fee > 0 && (userSnap.data()?.points || 0) < fee) {
            toast({ variant: "destructive", title: "點數不足", description: `手續費需要 ${fee} 點。` });
            setIsProcessing(false);
            return;
        }
        const batch = writeBatch(firestore);
        const cardsToShip = mergedCards.filter(c => selectedCardIds.has(c.id));
        const shippingOrderRef = doc(collection(firestore, 'shippingOrders'));
        batch.set(shippingOrderRef, {
            userId: user.uid,
            name: shippingName,
            phone: shippingPhone,
            cardIds: cardsToShip.map(c => ({ cardId: c.cardId, rarity: c.rarity, category: c.category, isFoil: c.isFoil })),
            cardCount: selectedCardIds.size,
            address: finalAddress,
            shippingMethod,
            status: 'pending',
            createdAt: serverTimestamp(),
            fee,
        });
        for (const card of cardsToShip) batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
        if (fee > 0) {
            batch.set(doc(collection(firestore, 'transactions')), {
                userId: user.uid, transactionType: 'Purchase', section: 'shipping', amount: -fee, details: `運單手續費`, transactionDate: serverTimestamp(),
            });
            batch.update(userRef, { points: increment(-fee) });
        }
        await batch.commit();
        toast({ title: "出貨請求已提交！", description: "請至會員中心追蹤進度。" });
        setSelectedCardIds(new Set());
        if(forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "出貨失敗", description: "權限不足或發生內部錯誤。" });
    } finally { setIsProcessing(false); }
  };

  if (!isUserLoading && !user) return (
    <div className="container py-20 text-center animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-4 text-white font-headline">請先登入以查看收藏庫</h2>
      <Button asChild className="rounded-xl"><Link href="/login">前往登入</Link></Button>
    </div>
  );

  if (isUserLoading) return (
    <div className="container py-20 text-center animate-fade-in-up">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
    </div>
  );

  const isAllSelected = mergedCards.length > 0 && selectedCardIds.size === mergedCards.length;

  const addressLabel = useMemo(() => {
    if (shippingMethod === '7-11') return '出貨門市';
    if (shippingMethod === '郵寄') return '寄送地址';
    return '自取地點';
  }, [shippingMethod]);

  return (
    <div className="container py-12 md:py-20 relative text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary/5 blur-[100px] pointer-events-none" />
      
      <div className="text-center mb-16 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-[0.3em] mb-4 uppercase animate-fade-in-up">
            <Library className="w-3 h-3" /> Digital Asset Vault
        </div>
        <h1 className="font-headline text-4xl font-black tracking-[0.2em] sm:text-6xl text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] mb-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            我的數位收藏
        </h1>
        <p className="text-muted-foreground font-medium animate-fade-in-up" style={{ animationDelay: '200ms' }}>管理您的珍稀卡片，點擊可查看正反面詳情。</p>
      </div>
      
      <div className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 lg:p-8 mb-16 shadow-2xl relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Sparkles className="w-32 h-32 text-primary" />
        </div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10 text-white">
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/20 p-3 rounded-2xl border border-primary/30">
                        <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-white font-headline tracking-tight">已選擇 {selectedCardIds.size} 張卡片</p>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Management Actions</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-muted-foreground uppercase">預計獲取:</span>
                        <div className="flex items-center gap-4">
                            <span className="font-code text-xl font-black text-primary flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                {conversionValues.diamonds.toLocaleString()} <Gem className="w-4 h-4"/>
                            </span>
                            <span className="font-code text-xl font-black text-accent flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                                {conversionValues.pPoints.toLocaleString()} <PPlusIcon className="w-4 h-4"/>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={mergedCards.length === 0} className="h-10 rounded-xl hover:bg-white/5 border border-white/5 text-white">
                            {isAllSelected ? <CheckSquare className="mr-2 text-primary h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
                            {isAllSelected ? '取消全選' : '全選所有'}
                        </Button>
                        {selectedCardIds.size > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearSelection} className="h-10 rounded-xl hover:bg-white/5 text-white/60">
                                <RotateCcw className="mr-2 h-4 w-4" /> 清除
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="lg" disabled={selectedCardIds.size === 0 || isProcessing} className="flex-1 lg:flex-none h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 font-bold text-white">
                            <Ship className="mr-2 h-5 w-5 text-primary" /> 批量出貨
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-white/10 shadow-2xl text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-3 text-2xl font-black font-headline text-white">
                                <Ship className="text-primary" /> 確認出貨請求
                                {hasFreeShipping && <Badge className="bg-green-500 animate-pulse border-none">免運福利</Badge>}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">請確認運送方式與收件資訊，提交後卡片將進入物流流程。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-6 my-4 p-2 text-white">
                            <RadioGroup defaultValue="7-11" onValueChange={(value: ShippingMethod) => setShippingMethod(value)} className="grid grid-cols-1 gap-3">
                                <div className={cn("flex items-center space-x-3 border p-4 rounded-2xl transition-all", shippingMethod === '7-11' ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/30' : 'hover:bg-white/5 border-white/10')}>
                                    <RadioGroupItem value="7-11" id="r1" /><Label htmlFor="r1" className="cursor-pointer flex-1 font-bold text-white">7-11 (手續費 {hasFreeShipping ? 0 : SHIPPING_FEE}💎)</Label>
                                </div>
                                <div className={cn("flex items-center space-x-3 border p-4 rounded-2xl transition-all", shippingMethod === '郵寄' ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/30' : 'hover:bg-white/5 border-white/10')}>
                                    <RadioGroupItem value="郵寄" id="r2" /><Label htmlFor="r2" className="cursor-pointer flex-1 font-bold text-white">郵寄 (手續費 {hasFreeShipping ? 0 : SHIPPING_FEE}💎)</Label>
                                </div>
                                <div className={cn("flex items-center space-x-3 border p-4 rounded-2xl transition-all", shippingMethod === '面交自取' ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/30' : 'hover:bg-white/5 border-white/10')}>
                                    <RadioGroupItem value="面交自取" id="r3" /><Label htmlFor="r3" className="cursor-pointer flex-1 font-bold text-white">面交自取 (免費)</Label>
                                </div>
                            </RadioGroup>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">收件姓名</Label>
                                    <Input value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="h-12 bg-background/50 rounded-xl text-white border-white/10" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">聯絡電話</Label>
                                    <Input value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} className="h-12 bg-background/50 rounded-xl text-white border-white/10" />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">{addressLabel}</Label>
                                {shippingMethod === '面交自取' ? (
                                    <div className="p-4 bg-primary/10 rounded-2xl border border-dashed border-primary/50 space-y-2">
                                        <p className="text-sm font-bold text-primary flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            自取地點：{PICKUP_ADDRESS}
                                        </p>
                                        <p className="text-[10px] text-white/60 leading-relaxed italic">
                                            來之前請務必先透過官方 Line@ 與我們預約時間，以免撲空喔！
                                        </p>
                                    </div>
                                ) : (
                                    <Input 
                                        value={shippingAddress} 
                                        onChange={(e) => setShippingAddress(e.target.value)} 
                                        placeholder={shippingMethod === '7-11' ? "請輸入 7-11 門市名稱" : "請輸入詳細實體地址"}
                                        className="h-12 bg-background/50 rounded-xl text-white border-white/10"
                                    />
                                )}
                            </div>

                            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1.5 text-left">
                                    <p className="text-xs font-black text-amber-500 uppercase tracking-wide">開箱權益與責任提醒</p>
                                    <p className="text-[11px] font-bold text-amber-200/80 leading-relaxed">
                                        ● 為保障您的換貨權益，收到包裹後請務必【全程錄影開箱】。若商品有重大瑕疵，需憑影片進行後續處理。<br />
                                        ● 請務必確認您的個人寄件資訊填寫正確。若因資訊錯誤導致配送失敗或商品遺失，相關責任將由消費者自行承擔。
                                    </p>
                                </div>
                            </div>
                        </div>
                        <AlertDialogFooter className="gap-3 pt-4">
                            <AlertDialogCancel className="h-12 rounded-2xl font-bold bg-white/5 border-white/10 text-white hover:bg-white/10">取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleShipping} disabled={isProcessing} className="h-12 rounded-2xl font-black bg-primary text-primary-foreground shadow-2xl border-none">
                                {isProcessing ? <Loader2 className="animate-spin" /> : '確認出貨申請'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button disabled={selectedCardIds.size === 0 || isProcessing} size="lg" className="flex-1 lg:flex-none h-14 px-8 rounded-2xl bg-destructive text-white hover:bg-destructive/90 font-black shadow-[0_0_20px_rgba(219,39,119,0.3)] transition-all active:scale-95 border-none">
                            <RefreshCw className="mr-2 h-5 w-5" /> 快速轉點
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-destructive/20 shadow-2xl text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-3 text-2xl font-black font-headline text-white">
                                <RefreshCw className="text-destructive" /> 確認快速轉點
                            </AlertDialogTitle>
                            <div className="py-4 space-y-6 text-left">
                                <AlertDialogDescription className="text-base text-white/70">
                                    確定要將所選的 {selectedCardIds.size} 張卡片進行轉點嗎？轉點後卡片將被回收，系統會按價值折算為鑽石與紅利 P 點。此操作不可撤銷。
                                </AlertDialogDescription>
                                
                                <div className="bg-destructive/5 p-6 rounded-3xl border border-destructive/20 space-y-4 shadow-inner">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-muted-foreground uppercase">獲得鑽石</span>
                                        <span className="font-code text-2xl font-black text-primary flex items-center gap-2 drop-shadow-md">
                                            {conversionValues.diamonds.toLocaleString()} <Gem className="w-5 h-5"/>
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-muted-foreground uppercase">獲得紅利 P 點</span>
                                        <span className="font-code text-2xl font-black text-accent flex items-center gap-2 drop-shadow-md">
                                            {conversionValues.pPoints.toLocaleString()} <PPlusIcon className="w-5 h-5"/>
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic text-center">注意：團拆限定卡片將會自動保留，不參與此次轉換。</p>
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel className="h-12 rounded-xl font-bold bg-white/5 border-white/10 text-white">取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleQuickSell} disabled={isProcessing} className="h-12 rounded-xl font-black bg-destructive text-white hover:bg-destructive/90 shadow-2xl border-none">
                                確認回收並轉換
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
      </div>

      <div className="space-y-20 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        {standardCards.length > 0 && (
            <section>
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <LayoutGrid className="text-primary w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black font-headline text-white tracking-widest">一般收藏區域</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1 opacity-60">Standard Collection Assets</p>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent ml-4 hidden sm:block" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-6">
                    {standardCards.map((card, index) => (
                        <div 
                            key={card.id} 
                            className="relative group animate-fade-in-up"
                            style={{ animationDelay: `${500 + index * 50}ms` }}
                            onClick={() => setPreviewCard(card)}
                        >
                            <CardItem 
                                name={card.name} 
                                imageUrl={card.imageUrl} 
                                backImageUrl={card.backImageUrl}
                                imageHint={card.imageHint} 
                                serialNumber={card.serialNumber} 
                                isFlippable={false} 
                                rarity={card.rarity} 
                                priority={index < 12} 
                            />
                            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selectedCardIds.has(card.id)} onCheckedChange={(c) => handleSelectCard(card.id, c)} className="bg-background/80 border-primary/50 h-5 w-5 data-[state=checked]:bg-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

        {groupBreakCards.length > 0 && (
            <section>
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                        <Users2 className="text-orange-500 w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black font-headline text-orange-400 tracking-widest">團拆精選專區</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1 opacity-60">Exclusive Team Break Rewards</p>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-orange-500/30 to-transparent ml-4 hidden sm:block" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-6">
                    {groupBreakCards.map((card, index) => (
                        <div 
                            key={card.id} 
                            className="relative group animate-fade-in-up"
                            style={{ animationDelay: `${600 + index * 50}ms` }}
                            onClick={() => setPreviewCard(card)}
                        >
                            <CardItem 
                                name={card.name} 
                                imageUrl={card.imageUrl} 
                                backImageUrl={card.backImageUrl}
                                imageHint={card.imageHint} 
                                serialNumber={card.serialNumber} 
                                isFlippable={false} 
                                rarity={card.rarity} 
                                priority={index < 12} 
                            />
                            <div className="absolute top-2 right-8 z-10">
                                <Badge className="bg-orange-500 text-white text-[8px] md:text-[10px] px-2 py-0.5 font-black uppercase shadow-lg border-none">LIVE</Badge>
                            </div>
                            <div className="absolute bottom-2 left-0 right-0 z-10 text-center px-2 pointer-events-none">
                                <div className="text-[7px] md:text-[9px] font-black text-white bg-black/80 backdrop-blur-md py-1 rounded-full border border-orange-500/30 uppercase tracking-tighter">重點卡片</div>
                            </div>
                            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selectedCardIds.has(card.id)} onCheckedChange={(c) => handleSelectCard(card.id, c)} className="bg-background/80 border-orange-500/50 h-5 w-5 data-[state=checked]:bg-orange-500" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

        {(isLoadingUserCards || isLoadingCards) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
                {Array.from({length: 16}).map((_, i) => <div key={i} className="aspect-2.5/3.5"><Skeleton className="h-full w-full rounded-2xl" /></div>)}
            </div>
        )}

        {!isLoadingUserCards && mergedCards.length === 0 && (
            <div className="text-center py-32 animate-fade-in-up">
                <div className="p-10 rounded-full bg-white/5 border border-dashed border-white/10 inline-block mb-6">
                    <Library className="w-16 h-16 text-muted-foreground opacity-20" />
                </div>
                <p className="text-muted-foreground text-xl font-bold uppercase tracking-[0.2em] mb-8">Vault is currently empty</p>
                <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] border-none"><Link href="/draw">開始您的收藏之旅 <ChevronRight className="ml-2 h-5 w-5" /></Link></Button>
            </div>
        )}
      </div>

      <div className="mt-20 text-center flex flex-col items-center opacity-20">
        <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Security Terminal • Verified Asset</p>
      </div>

      <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none shadow-none p-0 overflow-visible flex flex-col items-center justify-center gap-4 sm:gap-6 [&>button:last-child]:hidden">
            <DialogTitle><VisuallyHiddenPrimitive.Root>卡片預覽</VisuallyHiddenPrimitive.Root></DialogTitle>
            {previewCard && (
                <div className="w-full flex flex-col items-center gap-6 sm:gap-8 pt-4 animate-in zoom-in-95 duration-300">
                    <h2 className="text-base sm:text-xl font-black font-headline text-white drop-shadow-2xl tracking-tight leading-tight uppercase px-6 text-center max-w-[320px]">{previewCard.name}</h2>
                    
                    <div className="w-[80%] sm:w-full max-w-[280px] sm:max-w-[240px] mx-auto relative group">
                        <div className="absolute -inset-4 bg-primary/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardItem 
                            name={previewCard.name} 
                            imageUrl={previewCard.imageUrl} 
                            backImageUrl={previewCard.backImageUrl}
                            imageHint={previewCard.imageHint} 
                            serialNumber={previewCard.serialNumber} 
                            rarity={previewCard.rarity} 
                            isFlippable={true}
                            priority={true}
                        />
                    </div>
                    <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
                        <p className="text-[9px] text-primary font-bold uppercase tracking-[0.2em] animate-pulse">點擊卡片可翻轉查看</p>
                        <div className="flex items-center gap-3 mt-2 sm:mt-4">
                            <Badge variant="outline" className="capitalize border-primary/50 text-primary bg-black/60 backdrop-blur-xl px-4 py-1 font-black tracking-widest shadow-lg text-[10px]">
                                {previewCard.rarity}
                            </Badge>
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full text-[10px] font-code font-black text-white shadow-lg tracking-widest uppercase">
                                <Hash className="w-3 h-3 text-primary" />
                                {previewCard.serialNumber}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <Button 
                variant="ghost" 
                size="icon" 
                className="mt-2 sm:mt-4 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 h-10 w-10 sm:h-12 sm:w-12 shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                onClick={() => setPreviewCard(null)}
            >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}