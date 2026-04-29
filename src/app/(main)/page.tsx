'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Package, Users2, ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Crown, Gem, Megaphone } from 'lucide-react';
import { Logo, CrossedCardsIcon, LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewsPopup } from '@/components/news-popup';
import { SafeImage } from '@/components/safe-image';
import { FloatingCardsBackground } from '@/components/floating-cards-background';

interface NewsItem {
    id: string;
    title: string;
    content: string;
    category: string;
    type: 'text' | 'image';
    imageUrl?: string;
    createdAt?: { seconds: number };
    isPinned?: boolean;
}

interface Partner {
    id: string;
    name: string;
    logoUrl: string;
    order: number;
}

export default function Home() {
  const firestore = useFirestore();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(3));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);

  const partnersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'partners'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: partners, isLoading: isLoadingPartners } = useCollection<Partner>(partnersQuery);

  const systemConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'systemConfig', 'main');
  }, [firestore]);
  const { data: systemConfig } = useDoc<any>(systemConfigRef);

  return (
    <div className="flex flex-col min-h-screen">
      <NewsPopup />
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] md:min-h-[95vh] flex items-center justify-center overflow-hidden py-4 md:py-8">
        {(systemConfig?.showFloatingBackground !== false) && <FloatingCardsBackground />}

        <div className="container relative z-10 text-center space-y-6 md:space-y-10 px-4">
          {systemConfig?.announcement && (
            <div className="max-w-3xl mx-auto mb-8 animate-bounce-slow">
              <div className="bg-primary/20 backdrop-blur-md border border-primary/30 rounded-2xl p-4 md:p-6 flex items-center gap-4 text-left shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <div className="p-3 bg-primary rounded-xl shrink-0">
                  <Megaphone className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-primary font-black text-sm uppercase tracking-widest mb-1">系統公告 / SYSTEM NOTICE</h3>
                  <p className="text-white font-bold text-sm md:text-base leading-relaxed">{systemConfig.announcement}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] md:text-xs font-black tracking-[0.3em] font-headline mb-2 md:mb-4 animate-fade-in-up uppercase">
            <Sparkles className="w-3 h-3 md:w-4 md:h-4" /> 公開透明、機率披露、數位存證
          </div>
          
          <div className="space-y-3 md:space-y-4 animate-fade-in-up">
            <h1 className="font-headline text-5xl sm:text-7xl md:text-[12rem] font-black tracking-tighter leading-none relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-primary/40 drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]">
                    P+CARDER
                </span>
                <span className="absolute inset-0 text-white blur-[20px] md:blur-[30px] opacity-30 pointer-events-none select-none">P+CARDER</span>
            </h1>
            <p className="text-lg md:text-3xl text-muted-foreground max-w-2xl mx-auto font-body font-bold tracking-widest leading-relaxed opacity-80 [image-rendering:pixelated] font-mono">
                頂級球員卡福袋平台<br />
                <span className="text-primary/80">打造屬於你的玩卡體驗</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 animate-fade-in-up pt-8 md:pt-12">
            <Button size="lg" asChild className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-12 text-lg md:text-xl font-black rounded-2xl group shadow-[0_0_30px_rgba(6,182,212,0.4)] relative overflow-hidden transition-all hover:scale-105 active:scale-95 border-none">
              <Link href="/draw">
                <span className="relative z-10 flex items-center gap-3">
                    立即開啟卡包 <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/10 animate-shimmer pointer-events-none" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-bold rounded-2xl border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-all">
                <Link href="/about">了解品牌願景</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 最新消息中心 */}
      <section className="relative py-20 md:py-32 bg-card/10 border-y border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -mr-80 -mt-80 pointer-events-none" />
        <div className="container relative z-10 transition-transform duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16 gap-6">
                <div className="space-y-2 md:space-y-4">
                    <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs">
                        保持最新資訊
                    </div>
                    <h2 className="text-2xl md:text-5xl font-black font-headline flex items-center gap-3 md:gap-4 tracking-tight text-left text-white">
                        <Newspaper className="text-primary h-8 w-8 md:h-12 md:w-12" />
                        最新消息中心
                    </h2>
                </div>
                <Button variant="ghost" asChild className="hover:bg-primary/10 h-10 md:h-12 px-4 md:px-6 rounded-xl font-bold group w-fit text-white">
                    <Link href="/news" className="flex items-center gap-2 text-sm md:text-base">查看完整消息庫 <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform"/></Link>
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {isLoadingNews ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-4">
                            <Skeleton className="aspect-video w-full rounded-2xl" />
                        </div>
                    ))
                ) : (
                    newsItems?.map((item, index) => (
                        <Link 
                          key={item.id} 
                          href={`/news?id=${item.id}`}
                          className="group block h-full animate-fade-in-up"
                        >
                            <Card className="h-full overflow-hidden bg-card/40 border border-white/5 transition-all duration-500 hover:border-primary/50 hover:bg-card/60 hover:-translate-y-2 shadow-2xl rounded-3xl">
                                <CardContent className="p-0 flex flex-col h-full text-white">
                                    <div className="aspect-video relative overflow-hidden">
                                        {item.type === 'image' ? (
                                            <SafeImage 
                                                src={item.imageUrl || 'https://picsum.photos/seed/news/800/450'} 
                                                alt={item.title} 
                                                width={800}
                                                height={450}
                                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
                                        )}
                                        
                                        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-500" />

                                        <div className="absolute top-3 left-3 md:top-4 md:left-4 flex gap-2">
                                            {item.isPinned && <Badge className="bg-primary font-black shadow-lg text-[10px] border-none">置頂</Badge>}
                                            <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 font-bold text-[10px]">{item.category}</Badge>
                                        </div>

                                        <div className="absolute inset-0 flex items-center justify-center p-6 md:p-8 text-center">
                                            <h3 className="font-bold text-lg md:text-2xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-500">
                                                {item.title}
                                            </h3>
                                        </div>

                                        <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 flex items-center gap-2 text-[9px] md:text-[10px] text-white/80 font-code font-bold bg-black/40 px-2 py-1 md:px-3 md:py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                                            <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary" />
                                            {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </div>
      </section>

      {/* 為什麼選擇我們 */}
      <section className="py-12 md:py-24 bg-card/5 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="container relative z-10">
            <div className="text-center mb-12 md:mb-20 space-y-4 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs uppercase">
                    我們的核心優勢
                </div>
                <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-white">為什麼選擇我們</h2>
                <div className="w-16 h-1 bg-primary mx-auto rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 px-4">
                {[
                    { 
                        title: '公開透明存證', 
                        desc: '每一張核心卡片皆經數位存證，確保來源真實、所有權明確，打造最讓人放心的收藏環境。', 
                        icon: ShieldCheck, 
                        color: 'text-primary',
                        bg: 'bg-primary/10'
                    },
                    { 
                        title: '公平機率披露', 
                        desc: '絕不隱藏真實資訊，所有卡池機率完全公開披露，讓每一次抽卡都憑實力與運氣，回歸遊玩初衷。', 
                        icon: Target, 
                        color: 'text-yellow-400',
                        bg: 'bg-yellow-400/10'
                    },
                    { 
                        title: '即時互動體驗', 
                        desc: '打破實體卡片的侷限，隨時隨地享受極具張力的數位開包效果，將收藏熱忱轉化為指尖的極致快感。', 
                        icon: Zap, 
                        color: 'text-pink-400',
                        bg: 'bg-pink-400/10'
                    },
                    { 
                        title: '專屬藏友社群', 
                        desc: '透過團拆與互動競技，與志同道合的藏友並肩遊玩，交流珍稀卡片，建立屬於你的球員卡核心交友圈。', 
                        icon: Users2, 
                        color: 'text-green-400',
                        bg: 'bg-green-400/10'
                    },
                ].map((item, i) => (
                    <div 
                        key={i} 
                        className="p-8 rounded-3xl bg-card/40 border border-white/5 flex flex-col items-center text-center hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:bg-card/60 hover:-translate-y-2"
                    >
                        <div className={cn("p-4 rounded-full mb-6", item.bg, item.color)}>
                            <item.icon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black mb-3">{item.title}</h3>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* 多元遊戲專區 */}
      <section className="container py-20 md:py-32 relative text-white">
        <div className="text-center mb-16 md:mb-24 space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs mb-2 uppercase">
                核心遊戲生態系統
            </div>
            <h2 className="text-3xl md:text-6xl font-black font-headline tracking-tight">多元遊戲專區</h2>
            <div className="w-16 md:w-24 h-1 md:h-1.5 bg-primary mx-auto rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]" />
            <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg font-medium opacity-70">選擇您喜愛的遊戲模式，享受最極致的球員卡數位互動</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-6xl mx-auto">
          {[
            { 
                title: '抽卡專區', 
                desc: '數十款主題卡池，獨家傳奇巨星與限時最後賞等你入袋。體驗真實撕開卡包的悸動感。', 
                icon: Package, 
                href: '/draw', 
                color: 'text-amber-400',
                bg: 'bg-slate-950',
                border: 'border-amber-400/30',
                hoverGlow: 'hover:shadow-[0_0_40px_rgba(251,191,36,0.4)] hover:border-amber-400/80',
                iconBg: 'bg-amber-400/10'
            },
            { 
                title: '拚卡專區', 
                desc: '高風險高回報的幸運輪盤。自由挑選幸運號碼，1/10 中獎機率挑戰您的命運極限。', 
                icon: CrossedCardsIcon, 
                href: '/bet', 
                color: 'text-cyan-400',
                bg: 'bg-zinc-950',
                border: 'border-cyan-500/30',
                hoverGlow: 'hover:shadow-[inset_0_0_20px_rgba(6,182,212,0.3),0_0_20px_rgba(6,182,212,0.4)] hover:border-cyan-500/80',
                iconBg: 'bg-cyan-500/10'
            },
            { 
                title: '福袋專區', 
                desc: '經典福袋募集機制，滿團即開！保證出土頂級大獎，每一格都蘊含翻轉價值的可能。', 
                icon: LuckyBagIcon, 
                href: '/lucky-bags', 
                color: 'text-fuchsia-500',
                bg: 'bg-indigo-950',
                border: 'border-fuchsia-500/30',
                hoverGlow: 'hover:shadow-[0_0_30px_rgba(217,70,239,0.5)] hover:border-fuchsia-500/80',
                iconBg: 'bg-fuchsia-500/10'
            },
            { 
                title: '團拆專區', 
                desc: '精彩直播互動團拆，享受與其他藏友共享開箱的狂熱瞬間。公平配對，全場見證。', 
                icon: Users2, 
                href: '/group-break', 
                color: 'text-rose-500',
                bg: 'bg-neutral-900',
                border: 'border-rose-500/30',
                hoverGlow: 'hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:border-rose-500/80',
                iconBg: 'bg-rose-500/10'
            },
          ].map((item, i) => (
            <Link 
                key={i} 
                href={item.href} 
                className={cn(
                    "group relative p-8 md:p-12 xl:p-16 rounded-[3rem] border transition-all duration-500 hover:-translate-y-3 shadow-2xl overflow-hidden min-h-[380px] md:min-h-[420px] flex flex-col justify-between active:scale-[0.98]",
                    item.bg, item.border, item.hoverGlow
                )}
            >
              <div className="absolute top-10 right-10 flex gap-2 opacity-5 group-hover:opacity-20 transition-opacity pointer-events-none">
                  <div className={cn("w-8 h-8 rounded-full", item.iconBg)} />
                  <div className={cn("w-8 h-8 rounded-full", item.iconBg)} />
              </div>
              
              <div>
                <div className={cn("inline-flex p-5 md:p-6 rounded-[2rem] mb-8 md:mb-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-inner", item.iconBg, item.color)}>
                    <item.icon className="w-10 h-10 md:w-14 md:h-14" />
                </div>
                
                <div className="space-y-3 md:space-y-4 text-left">
                    <h3 className={cn("text-3xl md:text-5xl font-black font-headline tracking-tighter drop-shadow-md transition-colors duration-500", item.color)}>{item.title}</h3>
                    <p className="text-base md:text-lg text-white/70 leading-relaxed font-medium line-clamp-2 md:line-clamp-none">{item.desc}</p>
                </div>
              </div>
              
              <div className={cn("mt-8 md:mt-12 flex items-center text-sm md:text-base font-black font-headline tracking-[0.3em] transition-all duration-500 uppercase", item.color)}>
                ENTER <ChevronRight className="ml-2 w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 合作夥伴 Section */}
      <section className="container pb-20 md:pb-40 px-4 text-white">
        <div className="mb-20 md:mb-32">
            <div className="text-center mb-12 space-y-4">
                <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs uppercase">
                    合作夥伴
                </div>
                <h2 className="text-2xl md:text-4xl font-black font-headline tracking-tight text-white">我們的合作夥伴</h2>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
                {isLoadingPartners ? (
                    <Skeleton className="h-20 w-40 rounded-xl" />
                ) : (
                    partners?.map((partner) => (
                        <div key={partner.id} className="w-40 md:w-64 h-24 md:h-32 flex items-center justify-center grayscale hover:grayscale-0 transition-all">
                            <SafeImage src={partner.logoUrl} alt={partner.name} className="object-contain max-h-full" width={320} height={160} />
                        </div>
                    ))
                )}
            </div>
        </div>
      </section>

      {/* News Details Dialog (Fallback for cards if URL change isn't needed) */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-card/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]",
            selectedNews?.type === 'image' ? "max-w-4xl" : "max-w-2xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title || '最新消息'}</DialogTitle>
            <DialogDescription>最新消息詳情</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[90vh]">
            {selectedNews?.type === 'image' ? (
                <div className="flex flex-col text-white">
                    <div className="relative w-full aspect-auto min-h-[250px] md:min-h-[300px]">
                        {selectedNews.imageUrl && (
                            <Image 
                                src={selectedNews.imageUrl} 
                                alt={selectedNews.title} 
                                width={800}
                                height={450}
                                className="w-full h-auto object-contain block"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/news-fallback/800/450';
                                }}
                            />
                        )}
                    </div>
                    <div className="p-6 md:p-8 bg-black/40 flex flex-col md:flex-row md:items-center justify-between border-t border-white/5 gap-4">
                        <div className="flex items-center gap-3 md:gap-4">
                            <Badge className="bg-primary font-black px-2 md:px-3 py-1 shadow-lg text-[10px] md:text-xs border-none">
                                {selectedNews.category}
                            </Badge>
                            <span className="text-[10px] md:text-xs text-muted-foreground font-code font-bold">
                                {selectedNews.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </span>
                        </div>
                        <h2 className="text-lg md:text-xl font-black truncate">{selectedNews.title}</h2>
                    </div>
                </div>
            ) : (
                <div className="p-6 md:p-10 space-y-6 md:space-y-8 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3 md:gap-4">
                            <Badge className="bg-primary px-3 md:px-4 py-1 text-xs md:sm font-black shadow-lg border-none">
                                {selectedNews?.category}
                            </Badge>
                            <div className="flex items-center gap-2 text-muted-foreground text-[10px] md:text-sm font-code font-bold">
                            <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                            {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 md:space-y-6">
                        <h2 className="text-2xl md:text-5xl font-black font-body leading-tight tracking-tight text-left">{selectedNews?.title}</h2>
                        <Separator className="bg-white/10" />
                        <div 
                            className="prose prose-invert max-w-none text-white/80 leading-relaxed text-sm md:text-lg whitespace-pre-wrap font-body font-medium text-left"
                            dangerouslySetInnerHTML={{ __html: selectedNews?.content || '' }}
                        />
                    </div>
                </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}