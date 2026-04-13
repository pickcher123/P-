'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { LuckBagDetailView } from '@/components/luck-bag-detail-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { LuckBag, LuckBagWithCount, CardData } from '@/app/(main)/lucky-bags/page';

export default function LuckyBagPage() {
    const params = useParams();
    const luckBagId = params.luckBagId as string;
    const firestore = useFirestore();
    const router = useRouter();
    
    const [luckBagWithData, setLuckBagWithData] = useState<LuckBagWithCount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const luckBagRef = useMemoFirebase(() => {
        if (!firestore || !luckBagId) return null;
        return doc(firestore, 'luckBags', luckBagId);
    }, [firestore, luckBagId]);

    const { data: rawLuckBag, isLoading: isLoadingBag } = useDoc<LuckBag>(luckBagRef);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));

    useEffect(() => {
        const fetchExtraData = async () => {
            if (!rawLuckBag || !firestore || !allCards) return;

            setIsLoading(true);
            try {
                const purchasesColRef = collection(firestore, 'luckBags', rawLuckBag.id, 'luckBagPurchases');
                const countSnapshot = await getCountFromServer(query(purchasesColRef));
                const participantCount = countSnapshot.data().count;

                const cardMap = new Map(allCards.map(c => [c.id, c]));

                const prizeCards = {
                    first: rawLuckBag.prizes?.first ? cardMap.get(rawLuckBag.prizes.first) : undefined,
                    second: rawLuckBag.prizes?.second ? cardMap.get(rawLuckBag.prizes.second) : undefined,
                    third: rawLuckBag.prizes?.third ? cardMap.get(rawLuckBag.prizes.third) : undefined,
                };
                
                const otherPrizesList = (rawLuckBag.otherPrizes || [])
                    .map(p => {
                        const card = cardMap.get(p.cardId);
                        return card ? { ...card, prizeId: p.prizeId } : null;
                    })
                    .filter((c): c is CardData & { prizeId: string } => !!c);

                setLuckBagWithData({
                    ...rawLuckBag,
                    participantCount,
                    prizeCards,
                    otherPrizesList,
                });
            } catch (error) {
                console.error("Error fetching luck bag data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isLoadingBag && !isLoadingCards && rawLuckBag) {
            fetchExtraData();
        }
    }, [rawLuckBag, allCards, firestore, isLoadingBag, isLoadingCards]);

    const finalLoading = isLoadingBag || isLoadingCards || isLoading;

    if (finalLoading) {
        return (
            <div className="container py-20 flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <Loader2 className="w-16 h-16 animate-spin text-accent" />
                <p className="font-headline tracking-[0.3em] text-accent text-xl animate-pulse uppercase">Syncing Lucky Bag Module</p>
            </div>
        );
    }

    if (!luckBagWithData) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold">找不到此福袋活動。</h2>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => router.push('/lucky-bags')}>
                    返回福袋清單
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900/50 pb-20">
            <div className="container py-8">
                <Button 
                    variant="ghost" 
                    onClick={() => router.push('/lucky-bags')} 
                    className="mb-8 hover:bg-white/5 font-bold text-white group"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
                    返回福袋清單
                </Button>

                <div className="max-w-6xl mx-auto rounded-[3rem] overflow-hidden bg-slate-200 border-b-[16px] border-r-[16px] border-slate-400 shadow-[0_50px_100px_rgba(0,0,0,0.8)] animate-fade-in-up">
                    <LuckBagDetailView luckBag={luckBagWithData} />
                </div>
            </div>
        </div>
    );
}
