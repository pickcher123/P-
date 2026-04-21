
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, CheckCircle2, ChevronLeft, Zap, ShieldCheck, Palette, Bug, Globe, Crown, Search, Calculator } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/version';

interface ChangeLogItem {
  version: string;
  title: string;
  type: 'feature' | 'fix' | 'ui' | 'security' | 'seo';
  changes: string[];
}

const changelogData: ChangeLogItem[] = [
  {
    version: "1.0 (公開測試)",
    title: "公開測試版全面啟動：體驗優化",
    type: "feature",
    changes: [
      "優化收藏頁：移除原有的自動放大效果，改為點擊後觸發，大幅提升瀏覽流暢度。",
      "優化收藏頁卡片懸停體驗：非翻轉模式卡片新增「預覽放大鏡」懸停提示，直觀標示可檢視資產。",
      "服務條款全面更新：修正條款細節，更新生效日期至最新版本。"
    ]
  },
  {
    version: "7.4.5",
    title: "使用者體驗深度優化與介面整合",
    type: "ui",
    changes: [
      "優化 VIP 頁面手機版佈局：將「榮耀階級圖譜」改為橫向卡片，大幅減少垂直滾動。",
      "簡化 VIP 頁面「每日簽到」與「紅利點數」區塊，採用緊湊的上下排列設計。",
      "優化手機版拚卡專區遊戲規則，改為 2x2 四宮格佈局，提升資訊閱讀效率。",
      "整合導覽列點數顯示與加值功能，實現一體化設計，並優化彈出視窗佈局。",
      "調整「全部卡片」區塊佈局，將標題移至右側並縮減間距，提升整體視覺整齊度。"
    ]
  },
  {
    version: "7.4.4",
    title: "數位資產檢視與營運效率革命",
    type: "feature",
    changes: [
      "新增「全方位數位放大鏡」：支援卡片正面與背面 2.5x 高倍率檢視，完美呈現球員卡細節。",
      "導入「AI 營運價格推薦系統」：自動計算獎項總價值，提供科學化的一抽與三抽售價建議。",
      "重構「卡片預覽佈局」：名稱移至頂部並支援自動換行，比例縮減 1/3 以解決行動裝置跑版問題。",
      "優化「視覺純淨度」：移除卡片側邊黑塊與名稱遮罩，實現 100% 藝術圖像露出。",
      "優化手機版 Header 點數間距與返回按鈕位置，解決介面重疊並提升操作舒適度。"
    ]
  },
  {
    version: "7.4.3",
    title: "榮耀成就系統與視覺巔峰升級",
    type: "ui",
    changes: [
      "全面升級 VIP 階級頭像，引入 Progressive Aura (進階光暈) 與動態星芒特效。",
      "優化成就牆視覺層次，大幅提升「未解鎖成就」之辨識度與可讀性。",
      "調整全站遊戲專區為「扁平化一行四個」網格佈局，極大化寬螢幕視野。",
      "強化「卡片唯一資產制」邏輯，確保資產在全專區之獨特性與即時銷毀機制。"
    ]
  },
  {
    version: "7.4.2",
    title: "全球搜尋與 SEO 指數優化",
    type: "seo",
    changes: [
      "建構全站 JSON-LD 結構化資料 (Organization & WebSite)，提升 Google 品牌呈現。",
      "整合動態 Sitemap 自動生成系統與 Robots.txt 爬蟲權限規範。",
      "優化 Open Graph 與 Twitter Cards 社交分享標籤，支援美觀的預覽縮圖。",
      "修正頂部導覽鑽石餘額顯示間距，優化手機版操作寬鬆度。"
    ]
  },
  {
    version: "7.4.1",
    title: "核心品牌語更新與介面純淨化",
    type: "ui",
    changes: [
      "更新首頁品牌標語為「公開透明、機率披露、數位存證」。",
      "重構卡池獎項清冊，移除多餘英文標籤與剩餘量條，回歸純淨視覺。",
      "調整抽卡機台按鈕權重，引導高價值連抽操作。",
      "優化福袋募集進度線條，改用高對比實體線段呈現。"
    ]
  },
  {
    version: "7.4.0",
    title: "沉浸式全息 UI 升級",
    type: "ui",
    changes: [
      "全面升級全站頁面為玻璃擬態 (Glassmorphism) 風格。",
      "優化開獎前置流程，整合權益保障與即時金額確認。",
      "重構會員中心與收藏庫，強化資產視覺階級感。",
      "修復手機版分類導覽滑動體驗。"
    ]
  }
];

const typeStyles = {
  feature: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  fix: "bg-green-500/10 text-green-400 border-green-500/20",
  ui: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  security: "bg-red-500/10 text-red-400 border-red-500/20",
  seo: "bg-amber-500/10 text-amber-400 border-amber-400/20",
};

const typeIcons = {
  feature: Zap,
  fix: CheckCircle2,
  ui: Palette,
  security: ShieldCheck,
  seo: Globe,
};

export default function ChangeLogPage() {
  return (
    <div className="container py-12 md:py-20 max-w-4xl relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary/5 blur-[100px] pointer-events-none" />
      
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
        <div className="space-y-2">
          <Button variant="ghost" asChild className="-ml-4 mb-2 hover:bg-white/5 font-bold">
            <Link href="/about"><ChevronLeft className="mr-2 h-4 w-4" /> 返回關於我們</Link>
          </Button>
          <h1 className="font-headline text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <History className="h-10 w-10 text-primary" /> 更新日誌
          </h1>
          <p className="text-muted-foreground text-lg font-medium">紀錄 P+Carder 的成長軌跡與技術革新。</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-code text-base border-primary/30 text-primary bg-primary/5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          CURRENT VER: {APP_VERSION}
        </Badge>
      </div>

      <div className="space-y-10 relative z-10">
        <div className="absolute left-[19px] top-4 bottom-4 w-px bg-white/10 hidden md:block" />

        {changelogData.map((item, index) => {
          const Icon = typeIcons[item.type as keyof typeof typeIcons] || Bug;
          return (
            <div key={item.version} className="relative md:pl-12 group animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="absolute left-0 top-1.5 w-10 h-10 rounded-full bg-background border-2 border-primary/20 items-center justify-center hidden md:flex group-hover:border-primary group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all z-10">
                <Icon className={cn("h-5 w-5", 
                    item.type === 'feature' ? 'text-blue-400' : 
                    item.type === 'fix' ? 'text-green-400' : 
                    item.type === 'ui' ? 'text-purple-400' : 
                    item.type === 'seo' ? 'text-amber-400' : 'text-red-400')} />
              </div>

              <Card className="bg-card/30 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-500 rounded-[2rem] shadow-2xl overflow-hidden">
                <CardHeader className="p-6 md:p-8 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <Badge className={cn("px-2 py-0.5 font-black uppercase tracking-widest text-[10px]", typeStyles[item.type as keyof typeof typeStyles])}>
                        {item.type === 'seo' ? 'Search Engine' : item.type}
                      </Badge>
                    </div>
                    <span className="text-xl font-black font-headline text-white/20 group-hover:text-primary/40 transition-colors">
                      VER {item.version}
                    </span>
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-black text-white">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 md:p-8 pt-0">
                  <ul className="space-y-3">
                    {item.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground leading-relaxed font-medium">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0 shadow-[0_0_5px_rgba(6,182,212,1)]" />
                        <span className="text-sm md:text-base">{change}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-20 text-center space-y-4 py-12 border-t border-white/5 relative z-10">
        <p className="text-muted-foreground font-medium italic">感謝您的支持，我們會持續進化，打造最完美的收藏殿堂。</p>
        <Button asChild variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-bold h-12 px-8">
          <Link href="/">回首頁開始收藏之旅</Link>
        </Button>
      </div>
    </div>
  );
}
