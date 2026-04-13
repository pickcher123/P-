'use client';

import { useState, ChangeEvent, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, doc, updateDoc, query, writeBatch, serverTimestamp, arrayUnion, arrayRemove, getDocs, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Image as ImageIcon, Upload, ArrowLeft, Check, Settings, Gem, Package, Users, Trophy, Eye, EyeOff, Search, Loader2, Sparkles, Copy, ListChecks, UserCheck, Archive, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UserProfile } from '@/types/user-profile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PPlusIcon } from '@/components/icons';


type LuckBagStatus = 'draft' | 'published' | '已開獎';
type PrizeLevel = 'first' | 'second' | 'third';


// Types
interface OtherPrize {
  prizeId: string;
  cardId: string;
}

interface LuckBag {
  id?: string;
  name: string;
  price: number;
  totalParticipants: number;
  imageUrl: string;
  imageHint?: string;
  prizes?: {
    [key in PrizeLevel]?: string;
  };
  otherPrizes?: OtherPrize[];
  prizeImageUrls?: {
    [key in PrizeLevel]?: string;
  };
  status?: LuckBagStatus;
  revealLottery?: boolean;
  currency?: 'diamond' | 'p-point';
  winners?: {
    [key in PrizeLevel]?: number;
  } & {
    other?: { prizeId: string; spotNumber: number }[];
  };
  order?: number;
}

interface LuckBagPurchase {
  userId: string;
  username: string;
  spotNumber: number;
}

interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    sellPrice?: number;
    source?: string;
    isSold?: boolean;
}


export default function LuckBagDetailPage() {
  const router = useRouter();
  const params = useParams();
  const luckBagId = params.luckBagId as string;
  
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isPrizeDialogOpen, setIsPrizeDialogOpen] = useState(false);
  const [selectedPrizeLevel, setSelectedPrizeLevel] = useState<PrizeLevel | 'other'>('first');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [bagDetails, setBagDetails] = useState<Partial<LuckBag>>({});
  const [isPublished, setIsPublished] = useState(false);

  const [topPrizeWinningNumbers, setTopPrizeWinningNumbers] = useState<Record<PrizeLevel, string>>({ first: '', second: '', third: '' });
  const [otherPrizeWinningNumbers, setOtherPrizeWinningNumbers] = useState<Record<string, string>>({});
  const [isDistributing, setIsDistributing] = useState(false);
  const [selectedCardsToAdd, setSelectedCardsToAdd] = useState<string[]>([]);


  // Fetch Luck Bag details
  const luckBagRef = useMemoFirebase(() => {
    if (!firestore || !luckBagId) return null;
    return doc(firestore, 'luckBags', luckBagId);
  }, [firestore, luckBagId]);
  const { data: luckBag, isLoading: isLoadingBag, error: bagError } = useDoc<LuckBag>(luckBagRef);
  
  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !luckBagId) return null;
    return query(collection(firestore, 'luckBags', luckBagId, 'luckBagPurchases'));
  }, [firestore, luckBagId]);
  const { data: purchases, isLoading: isLoadingPurchases } = useCollection<LuckBagPurchase>(purchasesQuery);

  // Cross-area logic
  const { data: allCardPools } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: bettingItems } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: allLuckBags } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  const globallyAssignedCardIds = useMemo(() => {
    const ids = new Set<string>();
    allCardPools?.forEach(p => {
        p.cards?.forEach((c: any) => ids.add(c.cardId));
        if (p.lastPrizeCardId) ids.add(p.lastPrizeCardId);
    });
    bettingItems?.forEach(item => {
        item.allCardIds?.forEach((id: string) => ids.add(id));
    });
    allLuckBags?.forEach(bag => {
        if (bag.prizes?.first) ids.add(bag.prizes.first);
        if (bag.prizes?.second) ids.add(bag.prizes.second);
        if (bag.prizes?.third) ids.add(bag.prizes.third);
        bag.otherPrizes?.forEach((p: any) => ids.add(p.cardId));
    });
    return ids;
  }, [allCardPools, bettingItems, allLuckBags]);

  // Fetch ALL cards for the "Select Prize" dialog
  const allCardsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'allCards');
  }, [firestore]);
  const { data: allCards, isLoading: isLoadingAllCards } = useCollection<CardData>(allCardsCollectionRef);

  const { prizeCards, otherPrizesList } = useMemo(() => {
    if (!luckBag || !allCards) return { prizeCards: {}, otherPrizesList: [] };
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    const prizes: { [key in PrizeLevel]?: CardData } = {};
    if (luckBag.prizes?.first && cardMap.has(luckBag.prizes.first)) {
        prizes.first = cardMap.get(luckBag.prizes.first);
    }
    if (luckBag.prizes?.second && cardMap.has(luckBag.prizes.second)) {
        prizes.second = cardMap.get(luckBag.prizes.second);
    }
    if (luckBag.prizes?.third && cardMap.has(luckBag.prizes.third)) {
        prizes.third = cardMap.get(luckBag.prizes.third);
    }
    
    const otherPrizesData: (CardData & { prizeId: string })[] = (luckBag.otherPrizes || [])
        .map(p => {
            const card = cardMap.get(p.cardId);
            return card ? { ...card, prizeId: p.prizeId } : null;
        })
        .filter((c): c is CardData & { prizeId: string } => !!c);

    return { prizeCards: prizes, otherPrizesList: otherPrizesData };
  }, [luckBag, allCards]);


  const participantList = useMemo(() => {
    if (!purchases) return [];
    const list = purchases.map(p => ({
        ...p,
        username: p.username || '未知用戶'
    })).sort((a, b) => a.spotNumber - b.spotNumber);

    if (!searchTerm) return list;

    return list.filter(p => 
        p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.spotNumber.toString().includes(searchTerm)
    );
  }, [purchases, searchTerm]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    purchases?.forEach(p => map.set(p.userId, p.username || '未知用戶'));
    return map;
  }, [purchases]);


  useEffect(() => {
    if (luckBag) {
      setBagDetails({
        name: luckBag.name || '',
        price: luckBag.price || 0,
        totalParticipants: luckBag.totalParticipants || 0,
        prizes: luckBag.prizes || {},
        otherPrizes: luckBag.otherPrizes || [],
        status: luckBag.status || 'draft',
        revealLottery: luckBag.revealLottery || false,
        currency: luckBag.currency || 'p-point',
      });
      setIsPublished(luckBag.status === 'published');
    }
  }, [luckBag]);
  
  useEffect(() => {
    if (bagError) {
      toast({ variant: 'destructive', title: '錯誤', description: '無法載入福袋資料。' });
      router.push('/admin/lucky-bags');
    }
  }, [bagError, router, toast]);

  
  const handleUpdateBagDetails = async (field: keyof LuckBag, value: any) => {
    if (!luckBagRef) return;
    try {
        await updateDoc(luckBagRef, { [field]: value });
        toast({ title: '成功', description: `福袋 ${field} 已更新。` });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新福袋失敗。' });
    }
  }

  const handleStatusToggle = async (checked: boolean) => {
    setIsPublished(checked);
    await handleUpdateBagDetails('status', checked ? 'published' : 'draft');
  }

  const handleOpenPrizeDialog = (level: PrizeLevel | 'other') => {
    setSelectedCardsToAdd([]);
    setSelectedPrizeLevel(level);
    setIsPrizeDialogOpen(true);
  }

  const handleSelectPrize = async (card: CardData) => {
    if (!luckBagRef || selectedPrizeLevel === 'other') return;
    try {
        const prizeFieldPath = `prizes.${selectedPrizeLevel}`;
        
        await updateDoc(luckBagRef, { 
            [prizeFieldPath]: card.id
        });
        toast({ title: '成功', description: `獎項已設定為新卡片。`});
        setIsPrizeDialogOpen(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '設定獎項失敗。' });
    }
  }
  
  const handleAddOtherPrizes = async () => {
    if (!luckBagRef || selectedCardsToAdd.length === 0) return;
    try {
        const newPrizes: OtherPrize[] = selectedCardsToAdd.map(cardId => ({ cardId, prizeId: uuidv4() }));
        await updateDoc(luckBagRef, {
            otherPrizes: arrayUnion(...newPrizes)
        });
        toast({ title: '成功', description: `${selectedCardsToAdd.length} 張卡片已加入其他獎項。` });
        setIsPrizeDialogOpen(false);
    } catch (error) {
        console.error("Error adding other prizes:", error);
        toast({ variant: "destructive", title: "錯誤", description: "加入其他獎項時發生錯誤。" });
    }
  }


  const handleRemovePrize = async (level: PrizeLevel) => {
    if(!luckBagRef) return;
     try {
        const prizeFieldPath = `prizes.${level}`;
        await updateDoc(luckBagRef, { 
            [prizeFieldPath]: ''
        });
        toast({ title: '成功', description: `獎項已移除。`});
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '移除獎項失敗。' });
    }
  }

  const handleRemoveOtherPrize = async (prizeIdToRemove: string) => {
    if (!luckBagRef || !bagDetails.otherPrizes) return;
    try {
        const prizeToRemove = bagDetails.otherPrizes.find(p => p.prizeId === prizeIdToRemove);
        if (prizeToRemove) {
            await updateDoc(luckBagRef, {
                otherPrizes: arrayRemove(prizeToRemove)
            });
            toast({ title: '成功', description: '卡片已從其他獎項中移除。' });
        }
    } catch (error) {
        console.error("Error removing other prize:", error);
        toast({ variant: "destructive", title: "錯誤", description: "移除其他獎項時發生錯誤。" });
    }
  }

 const handleDistributePrizes = async () => {
    if (!firestore || !luckBagRef || !luckBag) {
        toast({ variant: 'destructive', title: '錯誤', description: '缺少必要的開獎資料。' });
        return;
    }
    
    setIsDistributing(true);
    
    try {
        const batch = writeBatch(firestore);

        const purchasesSnapshot = await getDocs(query(collection(firestore, 'luckBags', luckBagId, 'luckBagPurchases')));
        const currentPurchases = purchasesSnapshot.docs.map(doc => doc.data() as LuckBagPurchase);
        const purchaseMap = new Map(currentPurchases.map(p => [p.spotNumber, p.userId]));
        
        const finalWinners: Required<LuckBag>['winners'] = { first: 0, second: 0, third: 0, other: [] };
        
        for (const prizeLevel in topPrizeWinningNumbers) {
            const level = prizeLevel as PrizeLevel;
            const spotNumberStr = topPrizeWinningNumbers[level];
            const cardId = luckBag.prizes?.[level];
            const prizeCard = prizeCards[level];
            
            if (spotNumberStr && cardId && prizeCard) {
                const spotNumber = parseInt(spotNumberStr, 10);
                const winnerId = purchaseMap.get(spotNumber);

                if (winnerId) {
                    finalWinners[level] = spotNumber;
                    const newUserCardRef = doc(collection(firestore, 'users', winnerId, 'userCards'));
                    batch.set(newUserCardRef, { 
                        userId: winnerId, 
                        cardId: cardId, 
                        isFoil: true, 
                        rarity: 'legendary', 
                        source: 'lucky-bag',
                        breakTitle: `福袋: ${luckBag.name}`
                    });
                    
                    const winnerUsername = userMap.get(winnerId) || '幸運玩家';
                    batch.set(doc(collection(firestore, 'announcements')), {
                        username: winnerUsername,
                        action: `在福袋中獲得了${{first: '頭獎', second: '貳獎', third: '叁獎'}[level]}`,
                        prize: prizeCard.name,
                        prizeImageUrl: prizeCard.imageUrl,
                        rarity: 'legendary',
                        timestamp: serverTimestamp(),
                        section: luckBag.name
                    });
                    
                    batch.update(doc(firestore, 'allCards', cardId), { isSold: true });

                    const txRef = doc(collection(firestore, 'transactions'));
                    batch.set(txRef, {
                        userId: winnerId,
                        transactionType: 'Issuance',
                        section: 'lucky-bag',
                        amount: 0,
                        issuedValue: prizeCard.sellPrice || 0,
                        details: `獲得福袋大獎 (${{first: '頭獎', second: '貳獎', third: '叁獎'}[level]}): ${prizeCard.name}`,
                        transactionDate: serverTimestamp(),
                    });
                }
            }
        }

        for (const prizeId in otherPrizeWinningNumbers) {
            const spotNumberStr = otherPrizeWinningNumbers[prizeId];
            const otherPrize = luckBag.otherPrizes?.find(p => p.prizeId === prizeId);
            const cardInfo = otherPrizesList.find(p => p.prizeId === prizeId);

            if (spotNumberStr && otherPrize && cardInfo) {
                const spotNumber = parseInt(spotNumberStr, 10);
                const winnerId = purchaseMap.get(spotNumber);

                if (winnerId) {
                     finalWinners.other!.push({ prizeId: prizeId, spotNumber: spotNumber });
                     const newUserCardRef = doc(collection(firestore, 'users', winnerId, 'userCards'));
                     batch.set(newUserCardRef, {
                        userId: winnerId,
                        cardId: otherPrize.cardId,
                        isFoil: false,
                        rarity: 'common', 
                        source: 'lucky-bag',
                        breakTitle: `福袋: ${luckBag.name}`
                    });

                    batch.update(doc(firestore, 'allCards', otherPrize.cardId), { isSold: true });

                    const txRef = doc(collection(firestore, 'transactions'));
                    batch.set(txRef, {
                        userId: winnerId,
                        transactionType: 'Issuance',
                        section: 'lucky-bag',
                        amount: 0,
                        issuedValue: cardInfo.sellPrice || 0,
                        details: `獲得福袋獎項: ${cardInfo.name}`,
                        transactionDate: serverTimestamp(),
                    });
                }
            }
        }
        
        batch.update(luckBagRef, { 
            status: '已開獎', 
            revealLottery: false, 
            winners: finalWinners 
        });
        
        await batch.commit();
        
        toast({ title: '派獎成功', description: `已成功派發所有獎項並記錄價值。` });
        setTopPrizeWinningNumbers({ first: '', second: '', third: '' });
        setOtherPrizeWinningNumbers({});

    } catch (error: any) {
        console.error("Prize distribution failed:", error);
        toast({ variant: 'destructive', title: '錯誤', description: `派發獎項時發生錯誤: ${error.message}` });
    } finally {
        setIsDistributing(false);
    }
};

  const handleDuplicate = async () => {
    if (!firestore || !luckBag) return;
    try {
        const { id, winners, ...bagToCopy } = luckBag;
        const newBagData: any = {
            ...bagToCopy,
            name: `${luckBag.name} (複製)`,
            status: 'draft' as const,
            revealLottery: false,
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(firestore, 'luckBags'), newBagData);
        toast({ title: '複製成功', description: '已建立活動副本，正在跳轉...' });
        router.push(`/admin/lucky-bags/${docRef.id}`);
    } catch (error) {
        console.error("Error duplicating luck bag:", error);
        toast({ variant: 'destructive', title: '複製失敗' });
    }
  };


  const PrizeCard = ({ level, label, card }: {level: PrizeLevel, label: string, card?: CardData}) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4">
            {card ? (
                <Image src={card.imageUrl} alt={card.name} width={48} height={68} className="rounded-md object-cover" />
            ) : (
                <div className="w-12 h-16 bg-muted rounded-md flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-muted-foreground" />
                </div>
            )}
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold">{card ? card.name : '尚未設定'}</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenPrizeDialog(level)}>
                {card ? '更換' : '選擇卡片'}
            </Button>
            {card && (
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemovePrize(level)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
        </div>
    </div>
  );

  const PrizeImage = ({ card, className, alt }: { card?: CardData, className?: string, alt: string }) => (
    <div className={`relative bg-muted/50 rounded-md overflow-hidden flex items-center justify-center ${className}`}>
        {card ? (
            <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                className="object-cover"
                sizes="20vw"
            />
        ) : (
            <Trophy className="w-1/3 h-1/3 text-muted-foreground" />
        )}
         <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
         <p className="absolute bottom-2 left-2 text-white text-xs font-bold drop-shadow-md">{alt}</p>
    </div>
  );

  const availableCardsToSelect = useMemo(() => {
    if (!allCards) return [];
    
    // ENFORCE RULE: Filter out cards assigned to other areas
    const currentBagCardIds = new Set([
        luckBag?.prizes?.first,
        luckBag?.prizes?.second,
        luckBag?.prizes?.third,
        ...(luckBag?.otherPrizes?.map(p => p.cardId) || [])
    ]);

    return allCards.filter(c => 
        (!c.isSold && !globallyAssignedCardIds.has(c.id)) || 
        currentBagCardIds.has(c.id)
    );
  }, [allCards, globallyAssignedCardIds, luckBag]);

  if (isLoadingBag || !bagDetails) {
    return <div className="container p-8"><Skeleton className="w-full h-96" /></div>;
  }
  
  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
      <div>
        <div className="flex justify-between items-center mb-4">
            <Button variant="ghost" onClick={() => router.push('/admin/lucky-bags')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回福袋列表
            </Button>
            <div className="flex items-center gap-4">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Copy className="mr-2 h-4 w-4" /> 複製副本
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>確定要複製此福袋活動嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                                這將會建立一個新的草稿活動，包含目前福袋的所有獎項設定，但會清空購買紀錄。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDuplicate}>確認複製</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                 <div className="flex items-center space-x-2">
                    <Switch id="status-toggle" checked={isPublished} onCheckedChange={handleStatusToggle} disabled={bagDetails.status === '已開獎'} />
                    <Label htmlFor="status-toggle" className={cn("font-semibold", bagDetails.status === '已開獎' ? 'text-blue-500' : isPublished ? 'text-green-500' : 'text-muted-foreground')}>
                        {
                            {
                                'draft': <span className="flex items-center"><EyeOff className="mr-2 h-4 w-4"/>草稿</span>,
                                'published': <span className="flex items-center"><Eye className="mr-2 h-4 w-4"/>已上架</span>,
                                '已開獎': <span className="flex items-center"><Check className="mr-2 h-4 w-4"/>已開獎</span>
                            }[bagDetails.status || 'draft']
                        }
                    </Label>
                </div>
                {bagDetails.status === 'published' && !bagDetails.revealLottery && (
                    <Button 
                        variant="default" 
                        className="bg-primary hover:bg-primary/90 text-white font-bold ml-4"
                        onClick={() => handleUpdateBagDetails('revealLottery', true)}
                    >
                        <Play className="mr-2 h-4 w-4" /> 啟動開獎模式
                    </Button>
                )}
            </div>
        </div>

        {bagDetails.revealLottery ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <UICard>
                        <CardHeader>
                            <CardTitle className="text-primary flex items-center gap-2">
                                <ListChecks className="h-5 w-5" /> 序號擁有者對照
                            </CardTitle>
                            <CardDescription>即時顯示已購買該號碼的玩家名稱。</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="搜尋號碼或名稱..." 
                                        className="pl-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-[500px] border rounded-lg bg-muted/10">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-card z-10">
                                        <TableRow>
                                            <TableHead className="w-16">號碼</TableHead>
                                            <TableHead>會員名稱</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {participantList.map(p => (
                                            <TableRow key={p.spotNumber} className="hover:bg-white/5 cursor-default group">
                                                <TableCell className="font-bold text-lg font-code group-hover:text-primary transition-colors">#{p.spotNumber}</TableCell>
                                                <TableCell className="text-sm font-medium">{p.username}</TableCell>
                                            </TableRow>
                                        ))}
                                        {participantList.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center py-10 text-muted-foreground italic">無匹配的號碼</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </UICard>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <UICard className="border-destructive/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-destructive animate-pulse">
                                <Trophy className="h-6 w-6" /> 數位開獎儀表板
                            </CardTitle>
                            <CardDescription>請依據直播開獎結果，在下方輸入對應的中獎號碼。系統將即時發放資產。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(['first', 'second', 'third'] as PrizeLevel[]).map((level) => (
                                    <div key={level} className="flex flex-col p-4 border rounded-xl bg-card/50 hover:border-primary/50 transition-all">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="relative w-16 h-20 bg-muted rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-lg">
                                                {prizeCards[level] ? (
                                                    <Image src={prizeCards[level]!.imageUrl} alt={prizeCards[level]!.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full"><Trophy className="w-6 h-6 text-muted-foreground opacity-20" /></div>
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-[10px] font-black uppercase text-primary tracking-widest">{{first: 'Grand Prize 頭獎', second: 'Second Prize 貳獎', third: 'Third Prize 叁獎'}[level]}</p>
                                                <p className="font-bold text-sm truncate">{prizeCards[level] ? prizeCards[level]!.name : '尚未設定'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <Label className="text-[9px] uppercase font-bold text-muted-foreground mb-1 block">輸入中獎序號</Label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="例如: 8"
                                                    value={topPrizeWinningNumbers[level]}
                                                    onChange={(e) => setTopPrizeWinningNumbers(prev => ({...prev, [level]: e.target.value}))}
                                                    className="font-code text-lg font-black"
                                                />
                                            </div>
                                            {topPrizeWinningNumbers[level] && (
                                                <div className="pt-5 shrink-0">
                                                    <Badge className="bg-primary/20 text-primary border-primary/30 h-10 px-3">
                                                        <UserCheck className="w-3.5 h-3.5 mr-1.5"/> 
                                                        {userMap.get(purchases?.find(p => p.spotNumber === parseInt(topPrizeWinningNumbers[level]))?.userId || '') || '號碼錯誤'}
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Separator className="bg-white/5" />

                            <div className="space-y-4">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Package className="w-4 h-4"/> 其他獎項配置
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {otherPrizesList.map(prize => (
                                        <div key={prize.prizeId} className="flex items-center gap-3 p-3 border rounded-xl bg-white/5 group hover:bg-white/10 transition-all">
                                            <div className="relative w-10 h-14 rounded-md overflow-hidden border border-white/10">
                                                <Image src={prize.imageUrl} alt={prize.name} fill className="object-cover" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-bold text-xs truncate mb-1.5">{prize.name}</p>
                                                <Input 
                                                    type="number" 
                                                    placeholder="中獎號碼" 
                                                    className="h-8 font-code text-xs"
                                                    value={otherPrizeWinningNumbers[prize.prizeId] || ''} 
                                                    onChange={(e) => setOtherPrizeWinningNumbers(prev => ({...prev, [prize.prizeId]: e.target.value}))} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full h-14 text-lg font-black rounded-2xl shadow-xl shadow-destructive/20 bg-destructive hover:bg-destructive/90" disabled={isDistributing}>
                                            {isDistributing ? <Loader2 className="mr-2 animate-spin"/> : <Sparkles className="mr-2 h-5 w-5"/>}
                                            確認派發所有福袋獎項
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="light rounded-[2rem] bg-white text-slate-900 border-none shadow-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>開獎流程確認</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                系統將依照您輸入的序號，立即將實體卡片資產派發至得獎玩家的「收藏庫」中，並在營運報表中產生成本紀錄。此操作完成後不可撤銷。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="gap-3">
                                            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDistributePrizes} className="rounded-xl font-bold bg-destructive">確認並正式開獎</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </UICard>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                    <UICard>
                        <CardHeader>
                            <CardTitle className="flex items-center"><Settings className="mr-3 text-primary"/>福袋設定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="bag-name">名稱</Label>
                                <Input id="bag-name" value={bagDetails.name || ''} onChange={e => setBagDetails({...bagDetails, name: e.target.value})} onBlur={e => handleUpdateBagDetails('name', e.target.value)} className="bg-white text-slate-900 border-slate-200" />
                            </div>

                            <div className="space-y-3 p-4 bg-muted/20 border rounded-lg">
                                <Label className="flex items-center gap-2 font-bold"><Gem className="h-4 w-4 text-primary"/> 支付幣別設定</Label>
                                <RadioGroup 
                                    value={bagDetails.currency || 'p-point'} 
                                    onValueChange={(val) => {
                                        setBagDetails({ ...bagDetails, currency: val as 'diamond' | 'p-point' });
                                        handleUpdateBagDetails('currency', val);
                                    }}
                                    className="flex gap-6 pt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="diamond" id="cur-dia" />
                                        <Label htmlFor="cur-dia" className="cursor-pointer">鑽石 (Diamonds)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="p-point" id="cur-p" />
                                        <Label htmlFor="cur-p" className="cursor-pointer text-accent flex items-center gap-1"><PPlusIcon className="h-3 w-3"/> 紅利 P 點</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bag-price" className="flex items-center">
                                        {bagDetails.currency === 'p-point' ? <PPlusIcon className="mr-2 h-4 w-4 text-accent"/> : <Gem className="mr-2 h-4 w-4 text-primary"/>}
                                        價格
                                    </Label>
                                    <Input id="bag-price" type="number" value={bagDetails.price || 0} onChange={e => setBagDetails({...bagDetails, price: Number(e.target.value)})} onBlur={e => handleUpdateBagDetails('price', Number(e.target.value))} className="bg-white text-slate-900 border-slate-200" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bag-participants" className="flex items-center">
                                        <span className="flex items-center"><Users className="mr-2 h-4 w-4 text-accent"/>總名額</span>
                                    </Label>
                                    <Input id="bag-participants" type="number" value={bagDetails.totalParticipants || 0} onChange={e => setBagDetails({...bagDetails, totalParticipants: Number(e.target.value)})} onBlur={e => handleUpdateBagDetails('totalParticipants', Number(e.target.value))} className="bg-white text-slate-900 border-slate-200" />
                                </div>
                            </div>
                        </CardContent>
                    </UICard>
                    <UICard>
                        <CardHeader>
                            <CardTitle className="flex items-center"><ImageIcon className="mr-3 text-primary"/>獎品圖片預覽</CardTitle>
                            <CardDescription>這裡是卡片獎項的圖片</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="w-full aspect-[4/3] bg-card p-2 grid grid-cols-2 grid-rows-2 gap-2 rounded-md border">
                                <div className="col-span-1 row-span-2">
                                    <PrizeImage card={prizeCards.first} className="h-full" alt="頭獎"/>
                                </div>
                                <div className="col-span-1 row-span-1">
                                    <PrizeImage card={prizeCards.second} className="h-full" alt="貳獎"/>
                                </div>
                                <div className="col-span-1 row-span-1">
                                    <PrizeImage card={prizeCards.third} className="h-full" alt="叁獎"/>
                                </div>
                            </div>
                        </CardContent>
                    </UICard>
                </div>

                <UICard className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Trophy className="mr-3 text-primary"/>獎品設定</CardTitle>
                        <CardDescription>設定頭獎、貳獎、叁獎和其他獎勵。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <PrizeCard level="first" label="頭獎" card={prizeCards.first} />
                        <PrizeCard level="second" label="貳獎" card={prizeCards.second} />
                        <PrizeCard level="third" label="叁獎" card={prizeCards.third} />
                         <Separator />
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">其他獎項</h4>
                                <Button variant="secondary" size="sm" onClick={() => handleOpenPrizeDialog('other')}><PlusCircle className="mr-2 h-4 w-4"/>新增</Button>
                            </div>
                            <div className="border rounded-lg max-h-60 overflow-y-auto">
                                <Table>
                                    <TableBody>
                                        {otherPrizesList.length > 0 ? otherPrizesList.map((card, index) => (
                                            <TableRow key={`${card.prizeId}-${index}`}>
                                                <TableCell>
                                                    <Image src={card.imageUrl} alt={card.name} width={32} height={45} className="rounded-sm" />
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">{card.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveOtherPrize(card.prizeId)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground h-24">尚未設定其他獎項</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </UICard>
            </div>
        )}
      </div>
       
        <Dialog open={isPrizeDialogOpen} onOpenChange={setIsPrizeDialogOpen}>
            <DialogContent className="light max-w-4xl h-[80vh] flex flex-col p-8 bg-white border-none shadow-2xl rounded-2xl text-slate-900">
            <DialogHeader>
                <DialogTitle className="font-bold text-xl">選擇獎項</DialogTitle>
                <DialogDescription className="font-medium text-slate-500">
                  {selectedPrizeLevel === 'other' ? '勾選您想加入到「其他獎項」的卡片。' : `從卡片總管中選擇一張卡片作為「${selectedPrizeLevel}」獎項。`}系統會自動過濾已被佔用之資產。
                </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {isLoadingAllCards && Array.from({length: 10}).map((_, i) => <Skeleton key={i} className="h-48" />)}
                        {availableCardsToSelect.map(card => (
                            <div 
                                key={card.id} 
                                className="relative group p-2 border rounded-lg cursor-pointer hover:border-primary transition-all"
                                onClick={() => selectedPrizeLevel !== 'other' ? handleSelectPrize(card) : setSelectedCardsToAdd(prev => 
                                    prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
                                )}
                                 data-state={selectedCardsToAdd.includes(card.id) ? 'checked' : 'unchecked'}
                            >
                                <div className="aspect-[2.5/3.5] relative">
                                    <Image src={card.imageUrl} alt={card.name} fill className="object-cover rounded-md" />
                                    <div className={cn("absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", selectedPrizeLevel !== 'other' && 'group-active:opacity-100')}>
                                        <Check className="w-10 h-10 text-white"/>
                                    </div>
                                </div>
                                <p className="text-xs font-semibold mt-2 truncate">{card.name}</p>
                                {selectedPrizeLevel === 'other' && (
                                    <div className="absolute top-2 right-2 h-5 w-5 bg-background rounded-full flex items-center justify-center border transition-all scale-0 group-data-[state=checked]:scale-100">
                                        <Check className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                            </div>
                        ))}
                         {!isLoadingAllCards && availableCardsToSelect.length === 0 && (
                            <div className="col-span-full text-center py-10 text-muted-foreground flex flex-col items-center gap-4">
                                <Archive className="h-12 w-12 opacity-10" />
                                目前庫存中沒有符合條件且未被佔用的卡片。
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            {selectedPrizeLevel === 'other' && (
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPrizeDialogOpen(false)} className="font-bold">取消</Button>
                    <Button onClick={handleAddOtherPrizes} disabled={selectedCardsToAdd.length === 0} className="bg-slate-900 text-white font-bold">
                        新增 {selectedCardsToAdd.length} 個獎項
                    </Button>
                </DialogFooter>
            )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
