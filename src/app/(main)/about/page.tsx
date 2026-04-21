
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Building2, ShieldCheck, Library, ChevronRight, Sparkles, Heart, Scale } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafeImage } from '@/components/safe-image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';

export default function AboutPage() {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const fallbackOriginImage = PlaceHolderImages.find(img => img.id === 'about-origin');
  const originImageUrl = systemConfig?.aboutOriginImageUrl || fallbackOriginImage?.imageUrl || '';

  return (
    <div className="container py-12 md:py-20 space-y-16 relative">
      {/* 背景裝飾光源 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] pointer-events-none" />

      {/* 品牌故事標題 */}
      <div className="text-center space-y-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-[0.3em] mb-2 uppercase animate-fade-in-up">
            <Sparkles className="w-3 h-3" /> Our Brand Narrative
        </div>
        <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-fade-in-up">
            關於 <span className="text-primary">P+CARDER</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium animate-fade-in-up opacity-80" style={{ animationDelay: '100ms' }}>
            這不只是一個平台，而是一群收藏家為夢想打造的數位殿堂。
        </p>
      </div>

      {/* 核心故事區塊 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="space-y-8">
            <div className="space-y-4">
                <h2 className="text-3xl font-black font-headline text-white flex items-center gap-3">
                    <Heart className="text-destructive fill-destructive/20" /> 
                    起源：那一聲清脆的撕裂
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg font-medium">
                    還記得小時候，手裡緊握著零用錢，屏息凝神撕開卡包的那一秒嗎？那種期待與驚喜交織的心跳聲，是每一位收藏家心中最純粹的悸動。
                </p>
                <p className="text-muted-foreground leading-relaxed text-lg font-medium">
                    隨著時代演進，收藏的形式改變了，但那份「期待感」不該消失。P+Carder 的誕生，正是為了在數位時代，找回那份被遺忘的熱血。
                </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-[2rem] bg-card/30 backdrop-blur-xl border border-white/5 space-y-2 group hover:border-primary/30 transition-all">
                    <ShieldCheck className="w-8 h-8 text-primary mb-2" />
                    <h3 className="font-bold text-white">絕對的公平</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">我們堅持即時機率公開透明，讓每一抽都經得起驗證。</p>
                </div>
                <div className="p-6 rounded-[2rem] bg-card/30 backdrop-blur-xl border border-white/5 space-y-2 group hover:border-accent/30 transition-all">
                    <Library className="w-8 h-8 text-accent mb-2" />
                    <h3 className="font-bold text-white">永久的典藏</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">您的每一份戰利品，都是我們承諾守護的數位資產。</p>
                </div>
            </div>
        </div>

        <div className="flex justify-center">
            <div className="relative aspect-square max-w-xl w-full rounded-[2.5rem] overflow-hidden border border-white/10 group shadow-2xl bg-black">
                {originImageUrl && (
                    <SafeImage 
                        src={originImageUrl} 
                        alt="P+Carder Origin" 
                        fill
                        className="object-contain transition-transform duration-1000 group-hover:scale-105"
                        priority
                    />
                )}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
            </div>
        </div>
      </div>

      <Separator className="opacity-5" />

      {/* 願景詳細敘述 */}
      <Card className="max-w-4xl mx-auto bg-card/20 backdrop-blur-md border-white/5 rounded-[2.5rem] overflow-hidden animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <CardHeader className="p-8 md:p-12 pb-4">
          <CardTitle className="font-headline text-3xl text-primary flex items-center gap-3">
            我們的品牌願景 <span className="text-white/20 text-xl font-black">/ VISION</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 md:p-12 pt-0 space-y-8 text-muted-foreground leading-relaxed text-lg">
          <p>
            P+Carder 致力於構建一個「玩家優先」的生態系統。我們不只是在販售卡片，我們是在創造一個讓收藏家感到自豪的榮耀殿堂。從獨家的直播團拆、高風險高回報的拼卡競技，到每一份精心設計的福利，都是為了讓您的收藏旅程充滿儀式感。
          </p>
          <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-4">
            <p className="text-white font-bold text-xl italic">「讓收藏回歸熱愛，讓每一抽都充滿價值。」</p>
            <p className="text-sm">這是我們對所有玩家的承諾。無論您是資深藏家，還是剛被那一聲撕裂聲吸引的新手，P+Carder 永遠為您敞開大門。</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <p className="text-sm font-medium italic">感謝您加入我們，讓我們一起收藏未來。</p>
            <Button variant="outline" asChild className="rounded-full border-primary/30 hover:bg-primary/5">
                <Link href="/changelog">
                    <History className="mr-2 h-4 w-4" /> 查看系統進化史
                </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 公司資訊 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <Card className="bg-card/30 backdrop-blur-xl border-white/5 rounded-[2rem]">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3"><Building2 className="text-primary h-5 w-5" /> 公司資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">公司名稱</span>
                    <span className="font-bold text-white">云希國際股份有限公司</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">統一編號</span>
                    <span className="font-code text-primary font-black">90301251</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">官方 LINE@</span>
                    <span className="font-bold text-green-500">@288qqsyq</span>
                </div>
                <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">客服信箱</span>
                    <span className="text-white text-sm">pickcher1234@gmail.com</span>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-card/30 backdrop-blur-xl border-white/5 rounded-[2rem]">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3"><ShieldCheck className="text-accent h-5 w-5" /> 權益保障</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    依據消費者保護法第十九條第一項但書所稱合理例外情事，本平台提供之數位內容服務於提供後即完成，不適用七日鑑賞期之規定。
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    實體卡片商品若有非人為因素之重大瑕疵（如：嚴重破損、髒污），請於收到商品後七日內，透過官方 Line@ 與我們聯繫處理換貨。
                </p>
                <div className="pt-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="link" className="p-0 h-auto text-primary text-xs font-bold flex items-center group">
                                查看完整服務條款 <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-3xl border-primary/20 rounded-[2.5rem]">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black font-headline text-primary flex items-center gap-3">
                                    <Scale className="h-6 w-6" /> P+CARDER 服務條款
                                </DialogTitle>
                                <DialogDescription>請詳細閱讀以下條款以保障您的權益。</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-[60vh] pr-4 mt-4">
                                <div className="space-y-6 text-sm text-white/80 leading-relaxed pb-6">
                                    <section className="space-y-3">
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> 1. 數位內容服務說明</h4>
                                        <p>本平台提供之抽卡、福袋及拼卡等服務，皆屬於「非以有形媒介提供之數位內容」或「一經提供即為完成之線上服務」。依據《消費者保護法》第19條及《通訊交易解除權合理例外情事適用準則》第2條第5款規定，一旦點數扣除並執行遊戲動作，服務即告完成，不適用於通訊交易七日無條件退貨之規定。</p>
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> 2. 商品品質與瑕疵定義</h4>
                                        <p>本平台所發放之實體卡片均為正版授權商品。卡片價值會因稀有度、球員表現及市場供需而變動。職責定義如下：</p>
                                        <ul className="list-disc list-inside ml-4 space-y-1 opacity-80">
                                            <li>重大瑕疵：嚴重破損、大面積髒污、明顯摺痕。</li>
                                            <li>非瑕疵：因製程產生之細微刮痕（Surface Scratches）、邊角輕微白邊、卡面印刷輕微偏位。</li>
                                        </ul>
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> 3. 退換貨流程</h4>
                                        <p>若收到商品有上述重大瑕疵，請於收到包裹後「七日內」聯繫官方 Line@ 客服，並提供開箱影片作為憑證。經管理團隊確認後，將依情況提供換貨或點數補償。</p>
                                    </section>
                                    <section className="space-y-3">
                                        <h4 className="font-bold text-white text-lg flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> 4. 點數儲值與使用</h4>
                                        <p>鑽石與 P 點僅限於本平台內部使用，不可轉讓予第三方或要求兌換現金。如發現惡意刷點、利用漏洞等行為，本平台有權永久封鎖該帳戶並回收違法所得資產。</p>
                                    </section>
                                    <p className="pt-4 text-primary font-bold italic text-center">最後更新日期：2026年04月21日</p>
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="text-center pt-10 flex flex-col items-center opacity-20">
        <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Digital Vault • Authenticity Guaranteed</p>
      </div>
    </div>
  );
}
