'use client';

import { useState, ChangeEvent, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useAuth, useStorage, useDoc } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, setDoc, DocumentData, writeBatch, getDoc, addDoc, deleteDoc, query } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Image as ImageIcon, Upload, ArrowLeft, Check, Gem, Edit, Save, Search, Archive, CheckCircle2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    sellPrice?: number;
    source?: string;
    isSold?: boolean;
}

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

const CATEGORIES = ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他", "全部"];

export default function BettingCategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const categoryName = params.categoryName as string;
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [addCardCategoryFilter, setAddCardCategoryFilter] = useState('全部');
  const [currentCategoryName, setCurrentCategoryName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);


  const categoryDetailsRef = useMemoFirebase(() => {
      if (!firestore || !categoryName) return null;
      return doc(firestore, 'bettingCategories', decodeURIComponent(categoryName));
  }, [firestore, categoryName]);
  const { data: categoryDetails, isLoading: isLoadingCategoryDetails } = useDoc<BettingCategory>(categoryDetailsRef);

  const bettingItemsRef = useMemoFirebase(() => {
    if (!firestore || !categoryName) return null;
    return doc(firestore, 'betting-items', decodeURIComponent(categoryName));
  }, [firestore, categoryName]);
  const { data: bettingItems, isLoading: isLoadingBettingItems, setData: setBettingItems } = useDoc<BettingItems>(bettingItemsRef);


  const allCardsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'allCards');
  }, [firestore]);
  const { data: allCards, isLoading: isLoadingAllCards } = useCollection<CardData>(allCardsCollectionRef);

  // Global cross-area assignment check
  const { data: allCardPools } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: allBettingItems } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  const globallyAssignedCardIds = useMemo(() => {
    const ids = new Set<string>();
    allCardPools?.forEach(p => {
        p.cards?.forEach((c: any) => ids.add(c.cardId));
        if (p.lastPrizeCardId) ids.add(p.lastPrizeCardId);
    });
    allBettingItems?.forEach(item => {
        item.allCardIds?.forEach((id: string) => ids.add(id));
    });
    luckBags?.forEach(bag => {
        if (bag.prizes?.first) ids.add(bag.prizes.first);
        if (bag.prizes?.second) ids.add(bag.prizes.second);
        if (bag.prizes?.third) ids.add(bag.prizes.third);
        bag.otherPrizes?.forEach((p: any) => ids.add(p.cardId));
    });
    return ids;
  }, [allCardPools, allBettingItems, luckBags]);
  
  useEffect(() => {
    if (categoryDetails) {
        setCurrentCategoryName(categoryDetails.name);
    }
  }, [categoryDetails]);

  const { cardsInBet, availableCardsToAdd, soldCardIds } = useMemo(() => {
    if (!allCards) {
        return { cardsInBet: [], availableCardsToAdd: [], soldCardIds: new Set<string>() };
    }
    const cardsInBetIds = new Set(bettingItems?.allCardIds || []);
    const soldIds = new Set(bettingItems?.soldCardIds || []);
    
    const cardsInBet = allCards.filter(c => cardsInBetIds.has(c.id));
    
    const available = allCards.filter(card => 
        !card.isSold &&
        !globallyAssignedCardIds.has(card.id) &&
        !cardsInBetIds.has(card.id) &&
        card.source !== 'group-break'
    );
    
    let filtered = available;
    if (addCardCategoryFilter !== '全部') {
      filtered = available.filter(card => card.category === addCardCategoryFilter);
    }
    
    return { cardsInBet, availableCardsToAdd: filtered, soldCardIds: soldIds };
  }, [allCards, bettingItems, globallyAssignedCardIds, addCardCategoryFilter]);

  
  const handleOpenAddCardDialog = () => {
    setSelectedCards([]);
    setAddCardCategoryFilter('全部');
    setIsAddCardDialogOpen(true);
  }

  const handleConfirmAddCards = async () => {
    if (!firestore || !bettingItemsRef || selectedCards.length === 0) return;

    try {
        await updateDoc(bettingItemsRef, {
            allCardIds: arrayUnion(...selectedCards)
        });
        
        toast({ title: '成功', description: `已成功加入 ${selectedCards.length} 張卡片。`});
        setIsAddCardDialogOpen(false);
        if (bettingItems && setBettingItems) {
            setBettingItems({
                ...bettingItems,
                allCardIds: [...(bettingItems.allCardIds || []), ...selectedCards]
            });
        }

    } catch (e) {
        console.error("Error adding cards to betting category:", e);
        if ((e as any).code === 'not-found') {
            await setDoc(bettingItemsRef, { allCardIds: selectedCards, soldCardIds: [] });
            toast({ title: '成功', description: `已成功加入 ${selectedCards.length} 張卡片。`});
            setIsAddCardDialogOpen(false);
            if(setBettingItems) setBettingItems({ id: decodeURIComponent(categoryName), allCardIds: selectedCards, soldCardIds: [] });
        } else {
            toast({ variant: 'destructive', title: '錯誤', description: '加入卡片失敗，請查看控制台輸出。' });
        }
    }
  }
  
  const handleRemoveCard = async (cardId: string) => {
    if (!bettingItemsRef || !firestore) return;
    try {
        await updateDoc(bettingItemsRef, { 
          allCardIds: arrayRemove(cardId),
          soldCardIds: arrayRemove(cardId),
        });
        toast({ title: '成功', description: '卡片已從拼卡項目中移除。' });
        if (bettingItems && setBettingItems) {
            setBettingItems({
                ...bettingItems,
                allCardIds: (bettingItems.allCardIds || []).filter(id => id !== cardId),
                soldCardIds: (bettingItems.soldCardIds || []).filter(id => id !== cardId)
            });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '移除卡片失敗。'})
    }
  }

  const handleValueChange = async (cardId: string, newPrice: number) => {
    if(!firestore) return;
    if (isNaN(newPrice) || newPrice < 0) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的價格。' });
        return;
    }
    try {
        const cardRef = doc(firestore, 'allCards', cardId);
        await updateDoc(cardRef, { sellPrice: newPrice });
        toast({ title: '成功', description: '卡片價值已更新。' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新卡片價值失敗。' });
    }
  }

  const handleUpdateCategoryName = async () => {
    if (!firestore || !categoryDetails || !currentCategoryName || currentCategoryName === categoryDetails.name) {
        return;
    }

    setIsSavingName(true);
    const decodedOldId = decodeURIComponent(categoryName);
    const newCategoryId = currentCategoryName.toLowerCase().replace(/\s+/g, '-');
    
    try {
        if (newCategoryId === decodedOldId) {
            await updateDoc(doc(firestore, 'bettingCategories', decodedOldId), { name: currentCategoryName });
            toast({ title: '成功', description: '分類名稱已更新。' });
        } else {
            const batch = writeBatch(firestore);
            const newCategoryRef = doc(firestore, 'bettingCategories', newCategoryId);
            batch.set(newCategoryRef, { 
                ...categoryDetails, 
                id: newCategoryId, 
                name: currentCategoryName 
            });
            const oldItemsRef = doc(firestore, 'betting-items', decodedOldId);
            const itemsDoc = await getDoc(oldItemsRef);
            if (itemsDoc.exists()) {
                const newItemsRef = doc(firestore, 'betting-items', newCategoryId);
                batch.set(newItemsRef, itemsDoc.data());
                batch.delete(oldItemsRef);
            }
            batch.delete(doc(firestore, 'bettingCategories', decodedOldId));
            await batch.commit();
            toast({ title: '成功', description: `分類已重新命名為「${currentCategoryName}」。` });
            router.replace(`/admin/betting/${encodeURIComponent(newCategoryId)}`);
        }
    } catch (error) {
        console.error("Rename failed:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '更名失敗。' });
    } finally {
        setIsSavingName(false);
    }
  };

  const isLoading = isLoadingAllCards || isLoadingBettingItems || isLoadingCategoryDetails;


  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
      <div>
        <Button variant="ghost" onClick={() => router.push('/admin/betting')} className="mb-4 text-slate-700 font-bold hover:bg-slate-100">
            <ArrowLeft className="mr-2" />
            返回分類列表
        </Button>
        <UICard className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex-1 space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">分類名稱管理</Label>
                        <div className="flex gap-2">
                            <Input 
                                className="text-2xl font-headline font-bold h-12 text-slate-900 bg-white border-slate-200"
                                value={currentCategoryName || ''}
                                onChange={(e) => setCurrentCategoryName(e.target.value)}
                                disabled={isSavingName}
                            />
                            <Button variant="outline" className="h-12 border-slate-200" onClick={handleUpdateCategoryName} disabled={isSavingName || !currentCategoryName || currentCategoryName === categoryDetails?.name}>
                                {isSavingName ? <Loader2 className="animate-spin h-4 w-4"/> : <Save className="h-4 w-4" />}
                            </Button>
                        </div>
                   </div>
                   <div className="shrink-0 flex items-center gap-3">
                        <Badge variant="outline" className="h-12 px-4 rounded-xl border-slate-200 font-code font-black text-primary">
                            {cardsInBet.length} ITEMS IN POOL
                        </Badge>
                        <Button onClick={handleOpenAddCardDialog} className="h-12 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800"><PlusCircle className="mr-2 h-4 w-4"/>從卡片總管加入</Button>
                   </div>
                </div>
                <CardDescription className="mt-4">管理此分類中可供玩家拼卡的卡片項目。價格將自動換算為鑽石的 10% 作為單格成本。</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    <Table>
                        <TableHeader className="bg-slate-100">
                            <TableRow>
                            <TableHead className="w-24 pl-6 text-slate-900 font-black uppercase text-[10px]">圖片</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px]">名稱</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px]">分類</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px]">庫存狀態</TableHead>
                            <TableHead className="w-40 text-slate-900 font-black uppercase text-[10px]">卡片價值 (💎)</TableHead>
                            <TableHead className="w-[100px] text-right pr-6 text-slate-900 font-black uppercase text-[10px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={6} className="p-6"><Skeleton className="h-12 w-full rounded-xl" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && cardsInBet.map(card => (
                                <TableRow key={card.id} className="hover:bg-slate-100 transition-colors border-b">
                                    <TableCell className="pl-6 py-4">
                                        <div className="relative h-16 w-12 rounded overflow-hidden border border-slate-200 shadow-sm">
                                            <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-900">{card.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-none text-[10px] font-black uppercase tracking-tighter">
                                            {card.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {soldCardIds.has(card.id) || card.isSold ? (
                                            <Badge variant="secondary" className="text-[10px] font-black uppercase">已售出</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-green-500/50 text-green-600 bg-green-50 text-[10px] font-black uppercase">販售中</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative">
                                             <Gem className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-50" />
                                            <Input 
                                                type="number" 
                                                defaultValue={card.sellPrice} 
                                                className="pl-9 h-10 bg-white border-slate-200 rounded-lg font-code font-bold text-slate-900"
                                                onBlur={(e) => handleValueChange(card.id, Number(e.target.value))}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="light rounded-3xl bg-white text-slate-900 border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-bold">移除拼卡項目</AlertDialogTitle>
                                                    <AlertDialogDescription className="font-medium text-slate-500">確定要從拼卡清單中移除「{card.name}」嗎？這不會刪除原始卡片，但玩家將無法再針對此卡進行下注。</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-3">
                                                    <AlertDialogCancel className="font-bold">取消</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRemoveCard(card.id)} className="bg-destructive text-white font-bold">確定移除</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && cardsInBet.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                        <Archive className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        尚未加入任何可拼卡的卡片資產。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </UICard>
      </div>
      
        <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
            <DialogContent className="light max-w-4xl h-[85vh] flex flex-col p-8 rounded-[2rem] bg-white text-slate-900">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black font-headline tracking-tighter italic text-primary uppercase">從卡片總管配貨</DialogTitle>
                <DialogDescription className="font-medium text-slate-500">
                    勾選您想加入到此分類的卡片。系統已自動過濾掉已在其他區域架上、已售出或團拆限定的資產。
                </DialogDescription>
            </DialogHeader>
            <div className="mb-6 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="搜尋卡片名稱..." className="pl-10 h-11 border-slate-200 bg-white text-slate-900 font-bold" />
                </div>
                <Select value={addCardCategoryFilter} onValueChange={setAddCardCategoryFilter}>
                    <SelectTrigger className="w-48 h-11 border-slate-200 bg-white text-slate-900 font-bold">
                        <SelectValue placeholder="篩選運動分類" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-grow overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
                        {isLoadingAllCards && Array.from({length: 10}).map((_, i) => <Skeleton key={i} className="aspect-[2.5/3.5] rounded-xl" />)}
                        {availableCardsToAdd.map(card => (
                            <div 
                                key={card.id} 
                                className="relative group p-2 border border-slate-100 bg-slate-50/50 rounded-xl cursor-pointer transition-all hover:border-primary data-[state=checked]:border-primary data-[state=checked]:ring-4 data-[state=checked]:ring-primary/10"
                                data-state={selectedCards.includes(card.id) ? 'checked' : 'unchecked'}
                                onClick={() => {
                                    setSelectedCards(prev => 
                                        prev.includes(card.id)
                                        ? prev.filter(id => id !== card.id)
                                        : [...prev, card.id]
                                    )
                                }}
                            >
                                <div className="aspect-[2.5/3.5] relative rounded-lg overflow-hidden border border-white">
                                    <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-data-[state=checked]:opacity-100 transition-opacity flex items-center justify-center">
                                        <CheckCircle2 className="w-10 h-10 text-primary shadow-2xl" />
                                    </div>
                                </div>
                                <div className="p-2 space-y-1">
                                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">{card.category}</p>
                                    <p className="text-xs font-bold text-slate-900 truncate">{card.name}</p>
                                </div>
                            </div>
                        ))}
                         {!isLoadingAllCards && availableCardsToAdd.length === 0 && (
                            <div className="col-span-full py-20 text-center text-muted-foreground flex flex-col items-center gap-4">
                                <ImageIcon className="h-12 w-12 opacity-10" />
                                <p className="font-bold tracking-widest uppercase opacity-20 text-sm text-slate-400">目前庫存中沒有符合條件且未被佔用的資產</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter className="pt-6 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setIsAddCardDialogOpen(false)} className="h-12 rounded-xl font-bold px-8">取消</Button>
                <Button onClick={handleConfirmAddCards} disabled={selectedCards.length === 0} className="h-12 rounded-xl font-black px-10 shadow-xl bg-slate-900 text-white hover:bg-slate-800">
                    確認加入 {selectedCards.length} 張卡片
                </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>

    </div>
  );
}
