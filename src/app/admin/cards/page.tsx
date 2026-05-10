'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRequest, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Package, Swords, Ticket, Users2, LayoutGrid, ChevronRight, Layers, CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CardData {
    id: string;
    source?: string;
    isRecycled?: boolean;
}

const AREAS = [
    { id: 'draw', name: '抽卡區域', icon: Package, desc: '出現在抽卡卡池中的卡片資產', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { id: 'betting', name: '拼卡區域', icon: Swords, desc: '出現在拼卡專區中的卡片資產', color: 'text-pink-600', bg: 'bg-pink-50' },
    { id: 'lucky-bag', name: '福袋區域', icon: Ticket, desc: '作為福袋頭獎或普獎的卡片資產', color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'group-break', name: '團拆區域', icon: Users2, desc: '直播團拆專用的卡片資產', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'all', name: '全部卡片', icon: Layers, desc: '查看系統中所有的卡片資產與庫存', color: 'text-slate-600', bg: 'bg-slate-50' },
];

export default function CardsAdminAreaListPage() {
    const router = useRouter();
    const firestore = useFirestore();

    // Optimization: Use useRequest for summary counts on the admin area list.
    // Static snapshots are sufficient for this overview and prevent excessive reads.
    const { data: allCards, isLoading: isLoadingCards } = useRequest<CardData[]>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));
    const { data: cardPools } = useRequest<{cards?: {cardId: string}[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
    const { data: bettingItems } = useRequest<{allCardIds: string[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
    const { data: luckBags } = useRequest<{prizes?: any, otherPrizes?: {cardId: string}[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

    const counts = useMemo(() => {
        if (!allCards) return { draw: 0, betting: 0, 'lucky-bag': 0, 'group-break': 0, all: 0 };
        const allCardIdSet = new Set(allCards.map(c => c.id));

        const drawIds = new Set<string>();
        cardPools?.forEach(p => p.cards?.forEach(c => {
            if (allCardIdSet.has(c.cardId)) drawIds.add(c.cardId);
        }));

        const bettingIds = new Set<string>();
        bettingItems?.forEach(i => i.allCardIds?.forEach(id => {
            if (allCardIdSet.has(id)) bettingIds.add(id);
        }));

        const luckyBagIds = new Set<string>();
        luckBags?.forEach(b => {
            if(b.prizes?.first && allCardIdSet.has(b.prizes.first)) luckyBagIds.add(b.prizes.first);
            if(b.prizes?.second && allCardIdSet.has(b.prizes.second)) luckyBagIds.add(b.prizes.second);
            if(b.prizes?.third && allCardIdSet.has(b.prizes.third)) luckyBagIds.add(b.prizes.third);
            b.otherPrizes?.forEach(p => {
                if (allCardIdSet.has(p.cardId)) luckyBagIds.add(p.cardId);
            });
        });

        const groupBreakCount = allCards.filter(c => c.source === 'group-break').length;

        return {
            draw: drawIds.size,
            betting: bettingIds.size,
            'lucky-bag': luckyBagIds.size,
            'group-break': groupBreakCount,
            all: allCards.length
        };
    }, [allCards, cardPools, bettingItems, luckBags]);

    return (
        <div className="container mx-auto p-6 md:p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-primary" /> 卡片資產管理
                </h1>
                <p className="mt-2 text-slate-700 font-bold max-w-2xl leading-relaxed">
                    系統已自動比對卡片總管之現存資料。請選擇要管理的遊戲區域，進行精準的上傳與配貨。
                </p>
            </div>

            <Card className="border-slate-200 bg-white overflow-hidden shadow-md rounded-2xl">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-20"></TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">區域名稱</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">資產描述</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">精準統計</TableHead>
                            <TableHead className="text-right pr-8 text-slate-900 font-black uppercase text-[10px] tracking-widest">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {AREAS.map((area) => (
                            <TableRow key={area.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => router.push(`/admin/cards/area/${area.id}`)}>
                                <TableCell className="pl-8 py-6">
                                    <div className={cn("p-2.5 rounded-xl border transition-all group-hover:scale-110", area.bg, area.color, "border-slate-100")}>
                                        <area.icon className="h-5 w-5" />
                                    </div>
                                </TableCell>
                                <TableCell className="font-black text-lg text-slate-900">
                                    {area.name}
                                </TableCell>
                                <TableCell className="text-sm text-slate-700 font-bold">
                                    {area.desc}
                                </TableCell>
                                <TableCell>
                                    {isLoadingCards ? (
                                        <Skeleton className="h-5 w-12" />
                                    ) : (
                                        <Badge variant="secondary" className="bg-slate-900 text-white font-code px-3 border-none">
                                            {counts[area.id as keyof typeof counts]} ITEMS
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button variant="ghost" size="sm" className="font-black text-slate-700 group-hover:text-slate-950 transition-colors">
                                        管理資產 <ChevronRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
