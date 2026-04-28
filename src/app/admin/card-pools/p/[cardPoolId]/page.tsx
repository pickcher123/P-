'use client';

import { useState, ChangeEvent, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useAuth } from '@/firebase';
import { collection, updateDoc, doc, arrayUnion, arrayRemove, Timestamp, runTransaction, query, where, getDocs, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ArrowLeft, Check, Settings, Gem, Package, Clock, GripVertical, Palette, Trophy, Star, Diamond, Layers, Gift, ShieldCheck, Sparkles, Calculator, CheckCircle2, Search, Archive, Crown, Loader2, Save, Ban, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { PPlusIcon } from '@/components/icons';


const CATEGORIES = ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他", "全部"];
const RARITIES = ['legendary', 'rare', 'common'] as const;
type Rarity = typeof RARITIES[number];

const RARITY_LABELS: Record<Rarity, string> = {
    legendary: '傳奇 (Legendary)',
    rare: '稀有 (Rare)',
    common: '普通 (Common)'
};

interface CardInPool {
    cardId: string;
    quantity: number;
}
interface PointPrize {
    prizeId: string;
    points: number;
    quantity: number;
    rarity: Rarity;
}

// Types
interface CardPool {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  cards?: CardInPool[];
  pointPrizes?: PointPrize[];
  price?: number;
  price3Draws?: number;
  totalPacks?: number;
  remainingPacks?: number;
  hasProtection?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  currency?: 'diamond' | 'p-point';
  cardRarities?: { [cardId: string]: Rarity };
  lastPrizeCardId?: string;
  startsAt?: Timestamp;
  expiresAt?: Timestamp;
  dailyLimit?: number;
  minLevel?: string;
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

function RarityProbabilities({ pool, allCards }: { pool: Partial<CardPool>, allCards: CardData[] | null }) {
    const probabilities = useMemo(() => {
        const rarityCounts = { legendary: 0, rare: 0, common: 0 };
        let totalItems = 0;

        // 計算卡片數量 (只計算未售出的項目數量)
        if (pool.cardRarities && pool.cards) {
            pool.cards.forEach(cardInPool => {
                if (cardInPool.quantity > 0) {
                    const rarity = pool.cardRarities?.[cardInPool.cardId];
                    if (rarity) {
                        rarityCounts[rarity] += cardInPool.quantity;
                        totalItems += cardInPool.quantity;
                    }
                }
            });
        }
        
        // 計算點數獎項數量
        if (pool.pointPrizes) {
            pool.pointPrizes.forEach(prize => {
                if (prize.rarity && prize.quantity > 0) {
                    rarityCounts[prize.rarity] += prize.quantity;
                    totalItems += prize.quantity;
                }
            });
        }

        if (totalItems === 0) {
            return { legendary: 0, rare: 0, common: 0 };
        }
        
        return {
            legendary: (rarityCounts.legendary / totalItems) * 100,
            rare: (rarityCounts.rare / totalItems) * 100,
            common: (rarityCounts.common / totalItems) * 100,
        };
    }, [pool, allCards]);

    return (
        <UICard className="border-slate-200 shadow-sm bg-white">
            <CardHeader>
                <CardTitle className="flex items-center text-sm font-black uppercase tracking-widest text-slate-900"><GripVertical className="mr-2 text-primary h-4 w-4"/>機率即時預覽</CardTitle>
                <CardDescription className="text-slate-500 font-medium">根據剩餘未抽出之卡片與點數獎項自動計算。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-slate-900">
                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-2 font-black text-[10px] text-amber-600 uppercase tracking-widest"><Star className="h-3.5 w-3.5"/>傳奇 (LEGENDARY)</span>
                    <span className="font-code font-black text-slate-900">{probabilities.legendary.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-2 font-black text-[10px] text-cyan-600 uppercase tracking-widest"><Diamond className="h-3.5 w-3.5"/>稀有 (RARE)</span>
                    <span className="font-code font-black text-slate-900">{probabilities.rare.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-widest"><Layers className="h-3.5 w-3.5"/>普通 (COMMON)</span>
                    <span className="font-code font-black text-slate-900">{probabilities.common.toFixed(2)}%</span>
                </div>
            </CardContent>
        </UICard>
    );
}

export default function CardPoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cardPoolId = params.cardPoolId as string;
  
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [selectedCardsToAdd, setSelectedCardsToAdd] = useState<string[]>([]);
  const [targetPrizeType, setTargetPrizeType] = useState<'standard' | 'last'>('standard');
  
  const [poolDetails, setPoolDetails] = useState<Partial<CardPool>>({});
  const [addCardCategoryFilter, setAddCardCategoryFilter] = useState('全部');
  const [timeValue, setTimeValue] = useState("00:00");
  const [startTimeValue, setStartTimeValue] = useState("00:00");
  
  const [newPointPrize, setNewPointPrize] = useState({ points: 100, quantity: 10, rarity: 'common' as Rarity });

  // Fetch Card Pool details
  const cardPoolRef = useMemoFirebase(() => {
    if (!firestore || !cardPoolId) return null;
    return doc(firestore, 'cardPools', cardPoolId);
  }, [firestore, cardPoolId]);
  const { data: cardPool, isLoading: isLoadingPool, error: poolError } = useDoc<CardPool>(cardPoolRef);

  // Fetch ALL cards for the "Add Card" dialog
  const allCardsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'allCards');
  }, [firestore]);
  const { data: allCards, isLoading: isLoadingAllCards } = useCollection<CardData>(allCardsCollectionRef);

  useEffect(() => {
    async function fetchSalesStats() {

      if (!firestore || !cardPoolId || !allCards) return;
      setIsLoadingStats(true);
      try {
        console.log('DEBUG: Current user:', auth ? (auth.currentUser?.uid || 'no user') : 'no auth object', auth?.currentUser?.email);
        console.log('DEBUG: Firestore instance:', firestore);
        
        // Test access to each collection individually
        const collectionsToTest = ['transactions', 'allCards', 'drawnCardLogs'];
        for (const colName of collectionsToTest) {
            try {
                await getDocs(collection(firestore, colName));
                console.log(`DEBUG: Successfully accessed collection: ${colName}`);
            } catch (colErr) {
                console.error(`DEBUG: Failed to access collection: ${colName}`, colErr);
            }
        }


        


        // Calculate total pool value
        let totalPoolValue = 0;
        
        // Fetch the latest cards directly to ensure we have the most up-to-date sellPrice
        console.log('DEBUG: Fetching allCards...');
        const allCardsSnapshot = await getDocs(collection(firestore, 'allCards'));
        console.log('DEBUG: allCards fetched successfully.');
        const latestAllCards = allCardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardData));
        const cardMap = new Map(latestAllCards.map(c => [c.id, c.sellPrice || 0]));
        
        cardPool?.cards?.forEach(pc => {
            const price = cardMap.get(pc.cardId) || 0;
            totalPoolValue += price * pc.quantity;
        });
        cardPool?.pointPrizes?.forEach(pp => {
            // P-point prizes divided by 10
            if (pp && typeof pp.points === 'number') {
                totalPoolValue += (pp.points / 10) * (pp.quantity || 0);
            }
        });
        if (cardPool?.lastPrizeCardId) {
            totalPoolValue += cardMap.get(cardPool.lastPrizeCardId) || 0;
        }
        
        console.log('DEBUG: Querying drawnCardLogs...');
        const drawnLogsQuery = query(collection(firestore, 'drawnCardLogs'), where('poolId', '==', cardPoolId));
        const drawnLogsSnapshot = await getDocs(drawnLogsQuery);
        console.log('DEBUG: drawnCardLogs queried successfully.');
        
        let totalDrawnValue = 0;
        drawnLogsSnapshot.forEach(doc => {
            const log = doc.data();
            totalDrawnValue += log.sellPrice || 0;
        });
        
        setSalesStats({
            totalPoolValue,
            totalDrawnValue: totalDrawnValue,
            loss: totalSales - totalDrawnValue,
            totalRevenue: totalSales
        });
      } catch (e) {
        console.error('DEBUG: fetchSalesStats error:', e);
      } finally {
        setIsLoadingStats(false);
      }
      fetchSalesStats();
    }
  }, [firestore, cardPoolId, allCards, cardPool]);
  // Fetch all pools, betting items, and lucky bags to enforce the "assigned once" rule
  const { data: allCardPools } = useCollection<CardPool>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: bettingItems } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  // Aggregate all assigned card IDs
  const globallyAssignedCardIds = useMemo(() => {
    const ids = new Set<string>();
    
    // Cards in all pools (except current pool if we're just editing)
    allCardPools?.forEach(p => {
        if (p.id === cardPoolId) return; // Skip current pool
        p.cards?.forEach(c => ids.add(c.cardId));
        if (p.lastPrizeCardId) ids.add(p.lastPrizeCardId);
    });

    // Cards in betting items
    bettingItems?.forEach(item => {
        item.allCardIds?.forEach((id: string) => ids.add(id));
    });

    // Cards in lucky bags
    luckBags?.forEach(bag => {
        if (bag.prizes?.first) ids.add(bag.prizes.first);
        if (bag.prizes?.second) ids.add(bag.prizes.second);
        if (bag.prizes?.third) ids.add(bag.prizes.third);
        // Also ensure cards in "otherPrizes" are excluded
        bag.otherPrizes?.forEach((p: any) => ids.add(p.cardId));
    });

    return ids;
  }, [allCardPools, bettingItems, luckBags]);

  useEffect(() => {
    if (cardPool) {
      const details: Partial<CardPool> = {
        name: cardPool.name || '',
        description: cardPool.description || '',
        price: cardPool.price || 0,
        price3Draws: cardPool.price3Draws,
        totalPacks: cardPool.totalPacks || 0,
        remainingPacks: cardPool.remainingPacks ?? cardPool.totalPacks,
        hasProtection: cardPool.hasProtection !== false,
        isActive: cardPool.isActive !== false,
        isFeatured: cardPool.isFeatured || false,
        currency: cardPool.currency || 'diamond',
        cardRarities: cardPool.cardRarities || {},
        lastPrizeCardId: cardPool.lastPrizeCardId || '',
        startsAt: cardPool.startsAt,
        expiresAt: cardPool.expiresAt,
        cards: cardPool.cards || [],
        pointPrizes: cardPool.pointPrizes || [],
        dailyLimit: cardPool.dailyLimit || 0,
        minLevel: cardPool.minLevel || '新手收藏家',
      };
      setPoolDetails(details);
      if (cardPool.expiresAt) {
          setTimeValue(format(cardPool.expiresAt.toDate(), "HH:mm"));
      }
      if (cardPool.startsAt) {
          setStartTimeValue(format(cardPool.startsAt.toDate(), "HH:mm"));
      }
    }
  }, [cardPool]);


  // Aggregate all assigned card IDs
  const { cardsInPool, cardsInPoolIds } = useMemo(() => {
    if (!allCards || !cardPool?.cards) return { cardsInPool: [], cardsInPoolIds: new Set() };
    
    const cardIdToDataMap = new Map(allCards.map(c => [c.id, c]));
    const idSet = new Set<string>();

    const cards = cardPool.cards.filter(poolCard => poolCard.quantity > 0).map(poolCard => {
      const cardData = cardIdToDataMap.get(poolCard.cardId);
      if (cardData) {
        idSet.add(poolCard.cardId);
        return { ...cardData, quantity: poolCard.quantity };
      }
      return null;
    }).filter((c): c is CardData & { quantity: number } => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { cardsInPool: cards, cardsInPoolIds: idSet };
  }, [allCards, cardPool]);

  // 計算推薦價格
  const recommendedPrices = useMemo(() => {
    if (!allCards || !poolDetails || !poolDetails.totalPacks) return null;

    let totalValue = 0;
    const cardMap = new Map(allCards.map(c => [c.id, c.sellPrice || 0]));

    // 1. 加總所有一般卡片獎項價值
    poolDetails.cards?.forEach(pc => {
      const price = cardMap.get(pc.cardId) || 0;
      totalValue += price * pc.quantity;
    });

    // 2. 加上最後賞卡片價值
    if (poolDetails.lastPrizeCardId) {
      totalValue += cardMap.get(poolDetails.lastPrizeCardId) || 0;
    }

    // 3. 加上 P 點獎項價值 (假設 1 P 點價值等同 1 點數)
    poolDetails.pointPrizes?.forEach(pp => {
      totalValue += pp.points * pp.quantity;
    });

    // 公式：一抽價格 = 總獎品價格 * 2.5 / 總抽數
    const single = Math.round((totalValue * 2.5) / (poolDetails.totalPacks || 1));
    // 公式：三抽價格 = 一抽價 * 0.95 * 3
    const triple = Math.round(single * 0.95 * 3);

    return { single, triple };
  }, [allCards, poolDetails]);

  const lastPrizeCard = useMemo(() => {
    if (!allCards || !poolDetails.lastPrizeCardId) return null;
    return allCards.find(c => c.id === poolDetails.lastPrizeCardId);
  }, [allCards, poolDetails.lastPrizeCardId]);

  const topPrizeCards = useMemo(() => {
    if (!allCards || !cardPool?.cardRarities) return [];
    
    const cardIdToDataMap = new Map(allCards.map(c => [c.id, c]));
    const activePrizeCards: CardData[] = [];
    const addedCardIds = new Set<string>();

    for (const rarity of RARITIES) {
        if (activePrizeCards.length >= 4) break;
        
        const cardIdsForRarity = Object.entries(cardPool.cardRarities)
            .filter(([, r]) => r === rarity)
            .map(([id]) => id);

        for (const cardId of cardIdsForRarity) {
            if (activePrizeCards.length >= 4) break;
            
            const cardData = cardIdToDataMap.get(cardId);
            const poolEntry = cardPool.cards?.find(c => c.cardId === cardId);
            
            if (cardData && poolEntry && poolEntry.quantity > 0 && !addedCardIds.has(cardId)) {
                activePrizeCards.push(cardData);
                addedCardIds.add(cardId);
            }
        }
    }
    return activePrizeCards;
  }, [allCards, cardPool]);
  
  const availableCardsToAdd = useMemo(() => {
    if (!allCards) return [];
    
    // ENFORCE RULE: A card can only be assigned to ONE area at a time.
    // We show cards that are NOT sold AND NOT already in any pool/betting/bag.
    // However, we must allow cards that are ALREADY in the current pool to be seen if we're just updating them (but actually "Add Card" dialog is for new additions).
    
    const available = allCards.filter(card => 
        !card.isSold && 
        !globallyAssignedCardIds.has(card.id) &&
        !cardsInPoolIds.has(card.id) &&
        card.id !== poolDetails.lastPrizeCardId &&
        card.source !== 'group-break'
    );

    if (addCardCategoryFilter === '全部') {
        return available;
    }
    return available.filter(card => card.category === addCardCategoryFilter);
  }, [allCards, globallyAssignedCardIds, addCardCategoryFilter]);
  
  useEffect(() => {
    if (poolError) {
      toast({ variant: 'destructive', title: '錯誤', description: '無法載入卡池資料。' });
      router.push('/admin/card-pools');
    }
  }, [poolError, router, toast]);

  const handleUpdatePoolDetails = async (field: keyof CardPool, value: any) => {
    if (!cardPoolRef) return;
    try {
        const updateData: Partial<CardPool> = { [field]: value };
        await updateDoc(cardPoolRef, updateData);
        toast({ title: '成功', description: `卡池設定已更新。` });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新卡池失敗。' });
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    date.setHours(hours, minutes);
    const newTimestamp = Timestamp.fromDate(date);
    setPoolDetails({...poolDetails, expiresAt: newTimestamp });
    handleUpdatePoolDetails('expiresAt', newTimestamp);
  }

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;
      setTimeValue(newTime);
      if (poolDetails.expiresAt) {
          const newDate = poolDetails.expiresAt.toDate();
          const [hours, minutes] = newTime.split(':').map(Number);
          newDate.setHours(hours, minutes);
          const newTimestamp = Timestamp.fromDate(newDate);
          setPoolDetails({...poolDetails, expiresAt: newTimestamp });
          handleUpdatePoolDetails('expiresAt', newTimestamp);
      }
  }
  
  const handleStartDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hours, minutes] = startTimeValue.split(':').map(Number);
    date.setHours(hours, minutes);
    const newTimestamp = Timestamp.fromDate(date);
    setPoolDetails({...poolDetails, startsAt: newTimestamp });
    handleUpdatePoolDetails('startsAt', newTimestamp);
  }

  const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;
      setStartTimeValue(newTime);
      if (poolDetails.startsAt) {
          const newDate = poolDetails.startsAt.toDate();
          const [hours, minutes] = newTime.split(':').map(Number);
          newDate.setHours(hours, minutes);
          const newTimestamp = Timestamp.fromDate(newDate);
          setPoolDetails({...poolDetails, startsAt: newTimestamp });
          handleUpdatePoolDetails('startsAt', newTimestamp);
      }
  }

  const handleOpenAddCardDialog = (type: 'standard' | 'last' = 'standard') => {
    setTargetPrizeType(type);
    setSelectedCardsToAdd([]);
    setAddCardCategoryFilter('全部');
    setIsAddCardDialogOpen(true);
  }

  const handleConfirmAddCards = async () => {
    if (!cardPoolRef || selectedCardsToAdd.length === 0 || !cardPool) return;
    
    if (targetPrizeType === 'last') {
        const cardId = selectedCardsToAdd[0];
        await handleUpdatePoolDetails('lastPrizeCardId', cardId);
        setIsAddCardDialogOpen(false);
        return;
    }

    try {
        // 使用 Transaction 確保卡片列表正確更新，避免重複加入時導致的問題
        await runTransaction(firestore, async (transaction) => {
            const pSnap = await transaction.get(cardPoolRef);
            if (!pSnap.exists()) throw "Pool not found";
            const pData = pSnap.data() as CardPool;
            
            const existingCards = [...(pData.cards || [])];
            const existingRarities = { ...(pData.cardRarities || {}) };
            let addedCount = 0;

            selectedCardsToAdd.forEach(cardId => {
                const idx = existingCards.findIndex(c => c.cardId === cardId);
                if (idx > -1) {
                    existingCards[idx].quantity += 1;
                } else {
                    existingCards.push({ cardId, quantity: 1 });
                }
                if (!existingRarities[cardId]) {
                    existingRarities[cardId] = 'common';
                }
                addedCount += 1;
            });

            transaction.update(cardPoolRef, {
                cards: existingCards,
                cardRarities: existingRarities,
                totalPacks: (pData.totalPacks || 0) + addedCount,
                remainingPacks: (pData.remainingPacks || 0) + addedCount
            });
        });

        toast({ title: '成功', description: `${selectedCardsToAdd.length} 張卡片已加入卡池。`});
        setIsAddCardDialogOpen(false);
    } catch (error) {
        console.error("Error adding cards to pool:", error);
        console.log("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        toast({ 
            variant: "destructive", 
            title: "錯誤", 
            description: `加入卡片時發生錯誤: ${error instanceof Error ? error.message : JSON.stringify(error)}` 
        });
    }
  }

  const handleCardRarityInPoolChange = async (cardId: string, newRarity: Rarity) => {
    if (!cardPoolRef) return;
    try {
        const fieldPath = `cardRarities.${cardId}`;
        await updateDoc(cardPoolRef, { [fieldPath]: newRarity });
        setPoolDetails(prev => ({
            ...prev,
            cardRarities: {
                ...prev.cardRarities,
                [cardId]: newRarity
            }
        }));
        toast({ title: '成功', description: `卡片稀有度已更新。` });
    } catch (error) {
        console.error("Error updating card rarity in pool:", error);
        toast({ variant: "destructive", title: "錯誤", description: "更新卡片稀有度失敗。" });
    }
  };

  const handleRemoveCardFromPool = async (cardIdToRemove: string) => {
    if (!cardPoolRef || !cardPool || !cardPool.cards) return;
    const cardToRemove = cardPool.cards.find(c => c.cardId === cardIdToRemove);
     if (!cardToRemove) return;
    try {
        const newCardRarities = { ...cardPool.cardRarities };
        delete (newCardRarities as Record<string, Rarity>)[cardIdToRemove];
        
        const quantityToRemove = cardToRemove.quantity;
        const newRemainingPacks = Math.max(0, (cardPool.remainingPacks || 0) - quantityToRemove);

        await updateDoc(cardPoolRef, {
            cards: arrayRemove(cardToRemove),
            cardRarities: newCardRarities,
            totalPacks: Math.max(0, (cardPool.totalPacks || 0) - quantityToRemove),
            remainingPacks: newRemainingPacks
        });
        toast({ title: '成功', description: '卡片已從卡池中移除。' });
    } catch (error) {
        console.error("Error removing card from pool:", error);
        toast({ variant: "destructive", title: "錯誤", description: "移除卡片時發生錯誤。" });
    }
  }

  const handleAddNewPointPrize = async () => {
    if (!cardPoolRef || !newPointPrize.points || !newPointPrize.quantity) {
        toast({ variant: 'destructive', title: '錯誤', description: '點數和數量必須大於 0。' });
        return;
    }
    const prizeToAdd: PointPrize = { 
        ...newPointPrize, 
        prizeId: uuidv4(),
        points: Number(newPointPrize.points),
        quantity: Number(newPointPrize.quantity)
    };

    try {
        await runTransaction(firestore, async (transaction) => {
            const poolDoc = await transaction.get(cardPoolRef);
            if (!poolDoc.exists()) throw "Pool not found";

            const currentPool = poolDoc.data() as CardPool;
            const existingPrizes = (currentPool.pointPrizes || []).filter(p => p && typeof p === 'object' && 'points' in p);
            const newPointPrizes = [...existingPrizes, prizeToAdd]
                .sort((a, b) => (b.points || 0) - (a.points || 0));
            const newRemainingPacks = (currentPool.remainingPacks || 0) + prizeToAdd.quantity;
            
            transaction.update(cardPoolRef, {
                pointPrizes: newPointPrizes,
                totalPacks: (currentPool.totalPacks || 0) + prizeToAdd.quantity,
                remainingPacks: newRemainingPacks
            });
        });
        toast({ title: '成功', description: '紅利 P 點獎項已新增。' });
        setNewPointPrize({ points: 100, quantity: 10, rarity: 'common' });
    } catch (error) {
        console.error("Error adding point prize:", error);
        toast({ variant: "destructive", title: "錯誤", description: "新增獎項失敗。" });
    }
  }

    const handlePointPrizeRarityChange = async (prizeId: string, newRarity: Rarity) => {
        if (!cardPoolRef || !poolDetails.pointPrizes) return;

        const updatedPrizes = (poolDetails.pointPrizes || []).filter(p => p).map(p =>
            p.prizeId === prizeId ? { ...p, rarity: newRarity } : p
        );

        try {
            await updateDoc(cardPoolRef, { pointPrizes: updatedPrizes });
            setPoolDetails(prev => ({
                ...prev,
                pointPrizes: updatedPrizes
            }));
            toast({ title: '成功', description: `獎項稀有度已更新。` });
        } catch (error) {
            console.error("Error updating point prize rarity:", error);
            toast({ variant: "destructive", title: "錯誤", description: "更新稀有度失敗。" });
        }
    };

  const handleRemovePointPrize = async (prizeId: string) => {
      if (!cardPoolRef || !cardPool?.pointPrizes) return;

      const prizeToRemove = (cardPool.pointPrizes || []).filter(p => p).find(p => p.prizeId === prizeId);
      if (!prizeToRemove) return;

      try {
          await runTransaction(firestore, async (transaction) => {
              const poolDoc = await transaction.get(cardPoolRef);
              if (!poolDoc.exists()) throw "Pool not found";

              const currentPool = poolDoc.data() as CardPool;
              const newPointPrizes = (currentPool.pointPrizes || []).filter(p => p && p.prizeId !== prizeId);
              const newRemainingPacks = Math.max(0, (currentPool.remainingPacks || 0) - prizeToRemove.quantity);

              transaction.update(cardPoolRef, {
                  pointPrizes: newPointPrizes,
                  totalPacks: Math.max(0, (currentPool.totalPacks || 0) - prizeToRemove.quantity),
                  remainingPacks: newRemainingPacks
              });
          });
          toast({ title: '成功', description: '獎項已移除。' });
      } catch (error) {
          console.error("Error removing point prize:", error);
          toast({ variant: "destructive", title: "錯誤", description: "移除獎項失敗。" });
      }
  }

  if (isLoadingPool || !cardPool) {
    return <div className="container p-8"><Skeleton className="w-full h-96" /></div>;
  }

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8 text-slate-900">
      <div>
        <Button variant="ghost" onClick={() => router.push(`/admin/card-pools/c/${cardPool.categoryId}`)} className="mb-4 text-slate-700 font-bold hover:bg-slate-100">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回卡池列表
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <UICard className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center text-slate-900 font-black"><Settings className="mr-3 text-primary"/>卡池詳情設定</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">編輯卡池的基本資訊、價格、數量和銷售時間。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="pool-name" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">卡池名稱</Label>
                            <Input id="pool-name" value={poolDetails.name || ''} onChange={e => setPoolDetails({...poolDetails, name: e.target.value})} onBlur={e => handleUpdatePoolDetails('name', e.target.value)} className="h-12 border-slate-200 font-bold text-slate-900 bg-white" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="pool-description" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">活動描述</Label>
                            <Textarea id="pool-description" value={poolDetails.description || ''} onChange={e => setPoolDetails({...poolDetails, description: e.target.value})} onBlur={e => handleUpdatePoolDetails('description', e.target.value)} className="min-h-[100px] border-slate-200 font-medium bg-white" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                                <div className="space-y-0.5">
                                    <Label className="text-base flex items-center gap-2 font-black text-slate-900">
                                        <Ban className="h-4 w-4 text-rose-500" />
                                        卡池啟用狀態
                                    </Label>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Pool Status</p>
                                </div>
                                <Switch
                                    checked={poolDetails.isActive !== false}
                                    onCheckedChange={(checked) => {
                                        setPoolDetails({ ...poolDetails, isActive: checked });
                                        handleUpdatePoolDetails('isActive', checked);
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                                <div className="space-y-0.5">
                                    <Label className="text-base flex items-center gap-2 font-black text-slate-900">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        120秒 開獎保護
                                    </Label>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Security Lock Protocol</p>
                                </div>
                                <Switch
                                    checked={poolDetails.hasProtection !== false}
                                    onCheckedChange={(checked) => {
                                        setPoolDetails({ ...poolDetails, hasProtection: checked });
                                        handleUpdatePoolDetails('hasProtection', checked);
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100 shadow-inner">
                                <div className="space-y-0.5">
                                    <Label className="text-base flex items-center gap-2 text-amber-700 font-black">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                        標記為精選卡池
                                    </Label>
                                    <p className="text-[10px] text-amber-600/60 font-bold uppercase tracking-widest">Featured Spotlight</p>
                                </div>
                                <Switch
                                    checked={poolDetails.isFeatured || false}
                                    onCheckedChange={(checked) => {
                                        setPoolDetails({ ...poolDetails, isFeatured: checked });
                                        handleUpdatePoolDetails('isFeatured', checked);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 p-5 bg-slate-50 border border-slate-100 rounded-xl">
                            <Label className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-widest text-[10px]"><Gem className="h-4 w-4 text-primary"/> 支付幣別與結算貨幣</Label>
                            <RadioGroup 
                                value={poolDetails.currency || 'diamond'} 
                                onValueChange={(val) => {
                                    setPoolDetails({ ...poolDetails, currency: val as 'diamond' | 'p-point' });
                                    handleUpdatePoolDetails('currency', val);
                                }}
                                className="flex gap-8 pt-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="diamond" id="cur-dia" />
                                    <Label htmlFor="cur-dia" className="cursor-pointer font-bold text-slate-700">鑽石 (Diamonds)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="p-point" id="cur-p" />
                                    <Label htmlFor="cur-p" className="cursor-pointer text-amber-600 flex items-center gap-1 font-bold"><PPlusIcon className="h-3 w-3"/> 紅利 P 點</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 space-y-6">
                            <div className="flex items-center gap-2 text-slate-900 font-black text-sm uppercase tracking-widest">
                                <Ban className="w-4 h-4 text-rose-500" /> 參與限制 (限購機制)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="daily-limit" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">每日抽數限制 (0為不限)</Label>
                                    <Input id="daily-limit" type="number" value={poolDetails.dailyLimit ?? 0} onChange={e => setPoolDetails({...poolDetails, dailyLimit: Number(e.target.value)})} onBlur={e => handleUpdatePoolDetails('dailyLimit', Number(e.target.value))} className="h-12 border-slate-200 font-code font-black text-lg bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min-level" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">最低參與等級要求</Label>
                                    <Select value={poolDetails.minLevel || '新手收藏家'} onValueChange={(val) => { setPoolDetails({...poolDetails, minLevel: val}); handleUpdatePoolDetails('minLevel', val); }}>
                                        <SelectTrigger className="h-12 border-slate-200 font-bold bg-white text-slate-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userLevels.map(l => <SelectItem key={l.level} value={l.level} className="font-bold">{l.level}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="pool-price" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                                        {poolDetails.currency === 'p-point' ? <PPlusIcon className="h-4 w-4"/> : <Gem className="h-4 w-4 text-primary"/>}
                                        單抽價格
                                    </Label>
                                    <Input id="pool-price" type="number" value={poolDetails.price || 0} onChange={e => setPoolDetails({...poolDetails, price: Number(e.target.value)})} onBlur={e => handleUpdatePoolDetails('price', Number(e.target.value))} className="h-12 border-slate-200 font-code font-black text-lg text-slate-900 bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pool-price-3" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                                        {poolDetails.currency === 'p-point' ? <PPlusIcon className="h-4 w-4"/> : <Gem className="h-4 w-4 text-primary"/>}
                                        三連抽優惠價
                                    </Label>
                                    <Input id="pool-price-3" type="number" value={poolDetails.price3Draws || ''} placeholder="例如: 400" onChange={e => setPoolDetails({...poolDetails, price3Draws: Number(e.target.value)})} onBlur={e => handleUpdatePoolDetails('price3Draws', Number(e.target.value))} className="h-12 border-slate-200 font-code font-black text-lg text-slate-900 bg-white" />
                                </div>
                            </div>

                            {recommendedPrices && (
                                <div className="p-6 rounded-[2rem] border border-cyan-100 bg-cyan-50/50 space-y-4 shadow-inner">
                                    <div className="flex items-center gap-2 text-cyan-700 font-black text-xs uppercase tracking-widest">
                                        <Calculator className="w-4 h-4" /> 系統建議售價 (基於獎項總價值計算)
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-white shadow-sm">
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">建議 1 抽</p>
                                                <p className="font-code font-black text-2xl text-slate-900">{recommendedPrices.single.toLocaleString()} <span className="text-[10px] font-normal opacity-40">{poolDetails.currency === 'p-point' ? 'P' : '💎'}</span></p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-10 px-4 rounded-xl text-[10px] font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                                                onClick={() => {
                                                    setPoolDetails(prev => ({ ...prev, price: recommendedPrices.single }));
                                                    handleUpdatePoolDetails('price', recommendedPrices.single);
                                                }}
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary" /> 套用方案
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-white shadow-sm">
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">建議 3 抽 (95折)</p>
                                                <p className="font-code font-black text-2xl text-slate-900">{recommendedPrices.triple.toLocaleString()} <span className="text-[10px] font-normal opacity-40">{poolDetails.currency === 'p-point' ? 'P' : '💎'}</span></p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-10 px-4 rounded-xl text-[10px] font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                                                onClick={() => {
                                                    setPoolDetails(prev => ({ ...prev, price3Draws: recommendedPrices.triple }));
                                                    handleUpdatePoolDetails('price3Draws', recommendedPrices.triple);
                                                }}
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1.5 text-primary" /> 套用方案
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold italic">* 計算基準：(獎項總價值 * 2.5) / 總抽數。三連抽額外享有約 5% 之優惠折扣。</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pool-packs" className="flex items-center justify-between font-black text-[10px] uppercase text-slate-500 tracking-widest">
                                <span className="flex items-center"><Package className="mr-2 h-4 w-4 text-amber-500"/>目前池內剩餘總數 (包)</span>
                            </Label>
                            <Input id="pool-packs" type="number" value={poolDetails.remainingPacks || 0} readOnly className="bg-slate-50 font-black font-code text-xl border-slate-200 text-slate-900" />
                            <p className="text-[10px] text-slate-400 font-bold italic">系統自動計算目前池中所有剩餘卡片與點數獎項之總和。</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="pool-starts" className="flex items-center font-black text-[10px] uppercase text-slate-500 tracking-widest"><Clock className="mr-2 h-4 w-4 text-emerald-500"/>預約開賣時間</Label>
                                <div className="flex gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "flex-grow justify-start text-left font-bold border-slate-200 h-11 text-slate-900 bg-white",
                                                    !poolDetails.startsAt && "text-slate-400"
                                                )}
                                            >
                                                <GripVertical className="mr-2 h-4 w-4" />
                                                {poolDetails.startsAt ? format(poolDetails.startsAt.toDate(), "PPP") : <span>選擇日期</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={poolDetails.startsAt?.toDate()}
                                                onSelect={handleStartDateSelect}
                                                captionLayout="dropdown-buttons"
                                                fromYear={new Date().getFullYear()}
                                                toYear={new Date().getFullYear() + 5}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input type="time" value={startTimeValue} onChange={handleStartTimeChange} className="w-[120px] shrink-0 h-11 border-slate-200 font-code font-black text-slate-900 bg-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pool-expires" className="flex items-center font-black text-[10px] uppercase text-slate-500 tracking-widest"><Clock className="mr-2 h-4 w-4 text-rose-500"/>結束銷售時間</Label>
                                <div className="flex gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "flex-grow justify-start text-left font-bold border-slate-200 h-11 text-slate-900 bg-white",
                                                    !poolDetails.expiresAt && "text-slate-400"
                                                )}
                                            >
                                                <GripVertical className="mr-2 h-4 w-4" />
                                                {poolDetails.expiresAt ? format(poolDetails.expiresAt.toDate(), "PPP") : <span>選擇日期</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={poolDetails.expiresAt?.toDate()}
                                                onSelect={handleDateSelect}
                                                captionLayout="dropdown-buttons"
                                                fromYear={new Date().getFullYear()}
                                                toYear={new Date().getFullYear() + 5}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input type="time" value={timeValue} onChange={handleTimeChange} className="w-[120px] shrink-0 h-11 border-slate-200 font-code font-black text-slate-900 bg-white" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </UICard>

                 <UICard className="border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center text-slate-900 font-black"><Palette className="mr-3 text-primary"/>卡片獎項清單與等級</CardTitle>
                            <Button onClick={() => handleOpenAddCardDialog('standard')} size="sm" className="bg-slate-900 text-white font-bold rounded-xl"><PlusCircle className="mr-2 h-4 w-4" /> 加入卡片</Button>
                        </div>
                        <CardDescription className="text-slate-500 font-medium">
                            為此卡池中的每張卡片指定稀有度等級。
                            <span className="text-primary font-black ml-1">注意：玩家抽出之卡片會自動從池中扣除。</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[40rem] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow className="border-b-slate-200">
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] pl-8 py-5">卡片名稱</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] w-24">剩餘庫存</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] w-48">指定等級</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] w-24 text-right pr-8">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cardsInPool.map(card => (
                                        <TableRow key={card.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                            <TableCell className="font-black text-slate-900 pl-8">{card.name}</TableCell>
                                            <TableCell className="font-code font-black text-slate-700">{card.quantity} 包</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={poolDetails.cardRarities?.[card.id] || 'common'}
                                                    onValueChange={(value) => handleCardRarityInPoolChange(card.id, value as Rarity)}
                                                >
                                                    <SelectTrigger className="h-10 border-slate-200 font-bold bg-white text-slate-900">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {RARITIES.map(r => <SelectItem key={r} value={r} className="font-bold">{RARITY_LABELS[r]}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-10 w-10" onClick={() => handleRemoveCardFromPool(card.id)}>
                                                  <Trash2 className="h-4 w-4" />
                                               </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {cardsInPool.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-slate-400 font-bold italic">
                                          <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                          目前池中沒有剩餘卡片獎項。
                                        </TableCell>
                                      </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </UICard>

                <UICard className="border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b">
                       <CardTitle className="flex items-center text-amber-600 font-black"><PPlusIcon className="mr-3 h-5 w-5"/>紅利 P 點獎項配置</CardTitle>
                       <CardDescription className="text-slate-500 font-medium">玩家抽出點數獎項後，系統將直接存入其紅利錢包。</CardDescription>
                    </CardHeader>
                     <CardContent className="p-6 space-y-6">
                        <div className="flex flex-col sm:flex-row items-end gap-4 p-5 border border-amber-100 rounded-2xl bg-amber-50/30">
                           <div className="space-y-1.5 flex-grow w-full">
                                <Label htmlFor="points-prize" className="text-[10px] font-black uppercase text-amber-700 tracking-widest">獎勵額度 (P)</Label>
                                <Input id="points-prize" type="number" value={newPointPrize.points} onChange={e => setNewPointPrize({...newPointPrize, points: Number(e.target.value)})} className="h-11 border-slate-200 font-code font-black text-slate-900 bg-white" />
                           </div>
                           <div className="space-y-1.5 flex-grow w-full">
                                <Label htmlFor="points-quantity" className="text-[10px] font-black uppercase text-amber-700 tracking-widest">配置包數 (數量)</Label>
                                <Input id="points-quantity" type="number" value={newPointPrize.quantity} onChange={e => setNewPointPrize({...newPointPrize, quantity: Number(e.target.value)})} className="h-11 border-slate-200 font-code font-black text-slate-900 bg-white" />
                           </div>
                           <div className="space-y-1.5 w-full sm:w-48">
                                <Label htmlFor="points-rarity" className="text-[10px] font-black uppercase text-amber-700 tracking-widest">指定等級</Label>
                                <Select
                                    value={newPointPrize.rarity}
                                    onValueChange={(value) => setNewPointPrize(prev => ({...prev, rarity: value as Rarity}))}
                                >
                                    <SelectTrigger id="points-rarity" className="h-11 border-slate-200 font-bold bg-white text-slate-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {RARITIES.map(r => <SelectItem key={r} value={r} className="font-bold">{RARITY_LABELS[r]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                           <Button onClick={handleAddNewPointPrize} className="h-11 w-full sm:w-auto px-8 bg-amber-600 text-white font-black rounded-xl shadow-lg hover:bg-amber-700"><PlusCircle className="mr-2 h-4 w-4"/>確認新增</Button>
                        </div>
                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="border-b-slate-200">
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] pl-8 py-4">紅利獎勵</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px]">剩餘數量</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] w-48">等級</TableHead>
                                        <TableHead className="text-slate-900 font-black uppercase text-[10px] w-24 text-right pr-8">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {poolDetails.pointPrizes?.map(prize => (
                                        <TableRow key={prize.prizeId} className="hover:bg-slate-50 border-b-slate-100">
                                            <TableCell className="font-black font-code text-amber-600 flex items-center gap-2 text-lg pl-8">
                                                <PPlusIcon className="w-4 h-4"/>
                                                {prize.points.toLocaleString()} P
                                            </TableCell>
                                            <TableCell className="font-black text-slate-700">{prize.quantity} 包</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={prize.rarity}
                                                    onValueChange={(value) => handlePointPrizeRarityChange(prize.prizeId, value as Rarity)}
                                                >
                                                    <SelectTrigger className="h-9 border-slate-200 font-bold bg-white text-slate-900">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        {RARITIES.map(r => <SelectItem key={r} value={r} className="font-bold">{RARITY_LABELS[r]}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                               <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-9 w-9" onClick={() => handleRemovePointPrize(prize.prizeId)}>
                                                  <Trash2 className="h-4 w-4" />
                                               </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!poolDetails.pointPrizes || poolDetails.pointPrizes.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-slate-400 font-bold italic">尚未新增點數獎項。</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </UICard>

            </div>
            <div className="lg:col-span-1 space-y-8">
                <UICard className="border-amber-200 bg-amber-50/20 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center text-amber-700 text-lg font-black uppercase tracking-widest italic"><Gift className="mr-3 h-5 w-5"/>最後賞限定配置 (Last One)</CardTitle>
                        <CardDescription className="text-amber-600/70 font-medium">抽完池內最後一抽的玩家將額外獲得此項傳奇資產。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {lastPrizeCard ? (
                            <div className="space-y-4">
                                <div className="relative aspect-[2.5/3.5] rounded-2xl overflow-hidden border-2 border-amber-400 shadow-xl shadow-amber-200/50 bg-white p-2">
                                    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-100">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt={lastPrizeCard.name} fill className="object-cover" />
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 right-4 text-center">
                                        <p className="font-black text-xs text-white truncate drop-shadow-md">{lastPrizeCard.name}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="w-full h-11 border-slate-200 font-black bg-white text-slate-700 shadow-sm rounded-xl" onClick={() => handleOpenAddCardDialog('last')}>更換卡片</Button>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleUpdatePoolDetails('lastPrizeCardId', '')}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full h-40 border-dashed border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-primary transition-all rounded-2xl flex flex-col gap-3 group" onClick={() => handleOpenAddCardDialog('last')}>
                                <PlusCircle className="h-8 w-8 text-slate-300 group-hover:text-primary transition-colors" /> 
                                <span className="font-black text-slate-400 group-hover:text-slate-900 tracking-widest text-xs">點擊設定最後賞</span>
                            </Button>
                        )}
                    </CardContent>
                </UICard>

                <UICard className="border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="flex items-center text-slate-900 font-black uppercase tracking-widest text-sm"><Trophy className="mr-3 text-primary h-4 w-4" />大獎預覽矩陣</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">池中剩餘之傳奇 (Legendary) 獎項預覽。</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        {isLoadingAllCards ? <Skeleton className="h-48 w-full rounded-2xl" /> : (
                            <div className="grid grid-cols-2 gap-3">
                                {topPrizeCards.length > 0 ? topPrizeCards.map(card => (
                                    <div key={card.id} className="aspect-[2.5/3.5] relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm">
                                        <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover"/>
                                    </div>
                                )) : (
                                    <div className="col-span-full text-center text-slate-400 py-16 italic text-xs font-bold">
                                        目前卡池中無剩餘傳奇獎項
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </UICard>
                {poolDetails && <RarityProbabilities pool={poolDetails} allCards={allCards} />}
            </div>
        </div>
      </div>

      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
            <DialogContent className="light max-w-4xl h-[85vh] flex flex-col p-8 rounded-[2.5rem] bg-white text-slate-900">
            <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 italic uppercase"> {targetPrizeType === 'last' ? '設定最後賞指定資產' : `配置卡片至「${cardPool?.name}」`} </DialogTitle>
                <DialogDescription className="font-bold text-slate-500">
                {targetPrizeType === 'last' ? '請從清單中選擇一張卡片作為最後賞。' : '勾選您想加入此卡池的卡片。已在其他區域（卡池/拼卡/福袋）或已售出的資產將被過濾。'}
                </DialogDescription>
            </DialogHeader>
            <div className="mb-6 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="搜尋卡片名稱..." className="pl-10 h-11 border-slate-200 rounded-xl font-bold bg-white text-slate-900" />
                </div>
                <Select value={addCardCategoryFilter} onValueChange={setAddCardCategoryFilter}>
                    <SelectTrigger className="w-48 h-11 border-slate-200 rounded-xl font-bold bg-white text-slate-900">
                        <SelectValue placeholder="所有運動分類" />
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
                                className="relative group p-2 border border-slate-100 bg-slate-50/50 rounded-2xl cursor-pointer transition-all hover:border-primary hover:bg-white data-[state=checked]:border-primary data-[state=checked]:ring-4 data-[state=checked]:ring-primary/10"
                                data-state={selectedCardsToAdd.includes(card.id) ? 'checked' : 'unchecked'}
                                onClick={() => {
                                    if (targetPrizeType === 'last') {
                                        setSelectedCardsToAdd([card.id]);
                                    } else {
                                        setSelectedCardsToAdd(prev => 
                                            prev.includes(card.id)
                                            ? prev.filter(id => id !== card.id)
                                            : [...prev, card.id]
                                        )
                                    }
                                }}
                            >
                                <div className="aspect-[2.5/3.5] relative rounded-xl overflow-hidden border border-white shadow-sm">
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
                            <div className="col-span-full py-20 text-center text-slate-400 italic">
                                <Archive className="h-12 w-12 opacity-10 mx-auto mb-4" />
                                目前庫存中沒有符合條件且未被佔用的資產。
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter className="pt-6 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setIsAddCardDialogOpen(false)} className="h-12 rounded-xl font-bold px-8">取消操作</Button>
                <Button onClick={handleConfirmAddCards} disabled={selectedCardsToAdd.length === 0} className="h-12 rounded-xl bg-slate-900 text-white font-black px-10 shadow-xl hover:bg-slate-800 transition-all border-none">
                    {targetPrizeType === 'last' ? '確認選定為最後賞' : `確認配置 ${selectedCardsToAdd.length} 項資產`}
                </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
