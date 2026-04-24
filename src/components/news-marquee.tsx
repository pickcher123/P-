'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Megaphone, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface NewsItem {
    id: string;
    title: string;
    category: string;
    isPinned?: boolean;
    isMarquee?: boolean;
}

interface NewsMarqueeProps {
    isDrawing?: boolean;
}

export function NewsMarquee({ isDrawing }: NewsMarqueeProps) {
    const firestore = useFirestore();

    // 抓取最近的消息，前端過濾
    const newsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'news'),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
    }, [firestore]);

    const { data: newsItems, isLoading } = useCollection<NewsItem>(newsQuery);

    // 取得最新一則標記為跑馬燈的消息
    const latestMarqueeItem = useMemo(() => {
        if (!newsItems) return null;
        return newsItems.find(n => n.isMarquee === true);
    }, [newsItems]);

    if (isLoading || !latestMarqueeItem) {
        return null;
    }

    return (
        <div className={cn(
            "backdrop-blur-md border-b border-white/10 h-8 md:h-9 overflow-hidden relative flex items-center justify-between shadow-xl shadow-black/40 transition-colors duration-500",
            isDrawing ? "bg-black/80" : "bg-background/60"
        )}>
            <div className="flex items-center flex-1 overflow-hidden">
                {/* 品牌標籤 - 移至左側，增加左邊距以對齊 Logo */}
                <div className="px-2 md:px-5 z-20 flex items-center ml-1 md:ml-4">
                    <span className="text-[7px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em] italic whitespace-nowrap drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] animate-pulse-slow">
                        NEWS
                    </span>
                </div>

                {/* 固定內容區塊 */}
                <Link 
                    href={`/news?id=${latestMarqueeItem.id}`} 
                    className="flex items-center gap-2 md:gap-3 text-[9px] md:text-sm text-muted-foreground transition-all group overflow-hidden h-full px-2 md:px-4 animate-pulse-slowest"
                >
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* 置頂消息動態脈衝燈 */}
                        {latestMarqueeItem.isPinned ? (
                            <div className="flex items-center justify-center shrink-0">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                            </div>
                        ) : (
                            <Megaphone className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-30 shrink-0 transition-opacity" />
                        )}
                        
                        {/* 分類標籤：玻璃擬態風格 */}
                        <span className="bg-white/5 border border-white/10 text-[7px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded text-white/50 uppercase tracking-tighter shrink-0 transition-all">
                            {latestMarqueeItem.category}
                        </span>
                        
                        {/* 消息標題 */}
                        <span className="font-bold text-foreground/80 transition-colors truncate tracking-wide">
                            {latestMarqueeItem.title}
                        </span>
                        
                        {/* 引導圖示：點擊提示 */}
                        <div className="flex items-center gap-1 transition-all">
                            <span className="text-[8px] font-black uppercase tracking-widest text-primary/60 hidden md:inline">Detail</span>
                            <ChevronRight className="w-3 h-3 text-primary transition-transform" />
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
