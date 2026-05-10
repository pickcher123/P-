
'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, Ticket, Archive, Gem, Package, Swords, Users2, Newspaper, UserCircle, ShoppingBag, Palette, ShieldCheck, Plus, LayoutList, BarChartHorizontal, ArrowUpRight, Megaphone, Trash2, AlertTriangle, FileText, Lock, Loader2 } from 'lucide-react';
import { useRequest, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, doc, updateDoc, query, where, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import type { SystemConfig } from "@/types/system";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface GenericDoc { id: string; [key: string]: any; }

const QUICK_ACTIONS = [
    { label: '新增卡片', href: '/admin/cards/area/all', icon: Plus, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300' },
    { label: '處理出貨', href: '/admin/shipping', icon: Truck, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300' },
    { label: '發布公告', href: '/admin/news', icon: Newspaper, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300' },
    { label: '營業報表', href: '/admin/reports', icon: BarChartHorizontal, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300' },
];

const QUICK_LINKS = [
    { label: '卡片管理', href: '/admin/cards', icon: Archive, color: 'text-blue-600' },
    { label: '抽卡卡池', href: '/admin/card-pools', icon: Package, color: 'text-cyan-700' },
    { label: '拼卡項目', href: '/admin/betting', icon: Swords, color: 'text-pink-700' },
    { label: '福袋設定', href: '/admin/lucky-bags', icon: Ticket, color: 'text-amber-700' },
    { label: '會員列表', href: '/admin/users', icon: UserCircle, color: 'text-emerald-700' },
    { label: '消息發布', href: '/admin/news', icon: Newspaper, color: 'text-purple-700' },
    { label: '兌換商店', href: '/admin/rewards', icon: ShoppingBag, color: 'text-rose-700' },
    { label: '素材管理', href: '/admin/materials', icon: Palette, color: 'text-orange-700' },
    { label: '異常預警', href: '/admin/alerts', icon: AlertTriangle, color: 'text-rose-600' },
    { label: '操作日誌', href: '/admin/activity-logs', icon: FileText, color: 'text-slate-700' },
    { label: '優惠券管理', href: '/admin/coupons', icon: Ticket, color: 'text-emerald-600' },
    { label: '站內公告', href: '/admin/announcements', icon: Megaphone, color: 'text-blue-500' },
];

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';
const WIPE_PASSWORD = '90301251';

function BetaWipeDialog() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleWipe = async () => {
        if (!firestore) return;
        if (password !== WIPE_PASSWORD) {
            toast({ variant: 'destructive', title: '授權失敗', description: '刪除密碼不正確。' });
            return;
        }

        setIsWiping(true);
        try {
            const collectionsToClear = ['transactions', 'shippingOrders', 'wishes', 'announcements'];
            for (const colName of collectionsToClear) {
                const snap = await getDocs(collection(firestore, colName));
                const batch = writeBatch(firestore);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            const usersSnap = await getDocs(collection(firestore, 'users'));
            for (const userDoc of usersSnap.docs) {
                const batch = writeBatch(firestore);
                batch.update(userDoc.ref, {
                    points: 0,
                    bonusPoints: 0,
                    totalSpent: 0,
                    userLevel: '新手收藏家',
                    hasChangedUsername: false
                });
                const subCollections = ['userCards', 'missionProgress', 'poolStats', 'newsPreferences'];
                for (const sub of subCollections) {
                    const subSnap = await getDocs(collection(firestore, 'users', userDoc.id, sub));
                    subSnap.docs.forEach(sd => batch.delete(sd.ref));
                }
                await batch.commit();
            }

            toast({ title: '數據清除成功', description: '所有 Beta 測試數據已歸零。' });
            setIsOpen(false);
            setPassword('');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '清除失敗' });
        } finally {
            setIsWiping(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="w-full h-12 rounded-xl font-black shadow-lg shadow-destructive/20 mt-4">
                    <Trash2 className="mr-2 h-4 w-4" /> 執行 Beta 數據清除
                </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem] bg-white text-slate-900 border-none shadow-2xl p-8">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-rose-600">
                        <AlertTriangle className="h-6 w-6" /> 數據清除最高授權
                    </DialogTitle>
                    <DialogDescription className="font-bold text-slate-600 mt-2">
                        警告：此操作將永久刪除所有玩家的交易紀錄、出貨單、中獎跑馬燈紀錄、卡片收藏與點數資產。
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Lock className="w-3 h-3"/> 請輸入刪除密碼確認
                        </Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="請輸入 8 位數專屬代碼"
                            className="h-14 rounded-2xl border-slate-200 text-center font-code text-2xl tracking-[0.5em] font-black"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isWiping} className="font-bold">取消</Button>
                    <Button onClick={handleWipe} disabled={isWiping || !password} className="bg-rose-600 text-white hover:bg-rose-700 font-black h-12 px-8 rounded-xl shadow-xl">
                        {isWiping ? <Loader2 className="animate-spin mr-2"/> : null}
                        啟動全站重置程序
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    
    // Optimization: Use useRequest instead of useCollection for counts.
    // Dashboard counts don't need real-time synchronization which consumes heavy reads.
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useRequest<GenericDoc[]>(usersQuery);

    const luckBagsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]);
    const { data: luckBags, isLoading: isLoadingLuckBags } = useRequest<GenericDoc[]>(luckBagsQuery);

    const cardPoolsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]);
    const { data: cardPools, isLoading: isLoadingCardPools } = useRequest<GenericDoc[]>(cardPoolsQuery);

    const allCardsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useRequest<any[]>(allCardsQuery);

    const pendingShippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('status', '==', 'pending'));
    }, [firestore]);
    const { data: pendingOrders, isLoading: isLoadingOrders } = useRequest<GenericDoc[]>(pendingShippingQuery);
    
    // systemConfig is still a listener because it controls site-wide maintenance modes
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig, isLoading: isLoadingSystemConfig, forceRefetch } = useDoc<SystemConfig>(systemConfigRef);
    const [announcement, setAnnouncement] = useState('');
    
    useEffect(() => {
        if (systemConfig?.announcement) setAnnouncement(systemConfig.announcement);
    }, [systemConfig]);

    const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

    const totalUsers = users?.length ?? 0;
    const adminUsers = users?.filter((u: any) => u.role === 'admin').length ?? 0;
    const cardsInStock = allCards?.filter((c: any) => !c.isSold).length ?? 0;

    // 即時在線卡池判定邏輯
    const activePoolsCount = useMemo(() => {
        if (!cardPools) return 0;
        const now = Math.floor(Date.now() / 1000);
        return cardPools.filter(p => {
            const hasStock = (p.remainingPacks ?? 0) > 0;
            const isStarted = !p.startsAt || p.startsAt.seconds <= now;
            const isNotExpired = !p.expiresAt || p.expiresAt.seconds > now;
            return hasStock && isStarted && isNotExpired;
        }).length;
    }, [cardPools]);

    const handleFeatureToggle = async (flagName: keyof NonNullable<SystemConfig['featureFlags']>, isEnabled: boolean) => {
        if (!systemConfigRef) return;
        try {
            await updateDoc(systemConfigRef, {
                [`featureFlags.${flagName}`]: isEnabled,
            });
            toast({ title: '成功', description: '功能開關狀態已更新。' });
            if (forceRefetch) forceRefetch();
        } catch (error) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">營運概覽</h1>
                    <Badge variant="outline" className="text-xs font-bold text-slate-600 border-slate-300 bg-white">
                        V{APP_VERSION}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    </span>
                    系統狀態：正常運行
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {QUICK_ACTIONS.map((action) => (
                    <Button key={action.label} asChild variant="outline" className={cn("h-auto py-6 flex flex-col items-center gap-2 border-2 transition-all hover:scale-[1.02] shadow-sm font-black", action.color)}>
                        <Link href={action.href}>
                            <action.icon className="h-6 w-6" />
                            <span className="text-sm">{action.label}</span>
                        </Link>
                    </Button>
                ))}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: '會員總數', value: totalUsers, sub: `${adminUsers} 管理員`, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50/50', loading: isLoadingUsers },
                    { label: '在庫資產', value: cardsInStock, sub: '張卡片', icon: Archive, color: 'text-indigo-700', bg: 'bg-indigo-50/50', loading: isLoadingCards },
                    { label: '待出貨', value: pendingOrders?.length || 0, sub: '筆訂單', icon: Truck, color: 'text-amber-700', bg: 'bg-amber-50/50', loading: isLoadingOrders },
                    { label: '活動福袋', value: luckBags?.length || 0, sub: '個專案', icon: Ticket, color: 'text-rose-700', bg: 'bg-rose-50/50', loading: isLoadingLuckBags },
                    { label: '在線卡池', value: activePoolsCount, sub: `共 ${cardPools?.length || 0} 個項目`, icon: Package, color: 'text-cyan-700', bg: 'bg-cyan-50/50', loading: isLoadingCardPools },
                ].map((stat, i) => (
                    <Card key={i} className={cn("border-slate-200 shadow-sm bg-white overflow-hidden", stat.bg)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</CardTitle>
                            <stat.icon className={cn("h-4 w-4", stat.color)} />
                        </CardHeader>
                        <CardContent>
                            {stat.loading ? <Skeleton className="h-8 w-16" /> : <div className={cn("text-2xl font-black font-code", stat.color)}>{stat.value}</div>}
                            <p className="text-[10px] text-slate-500 mt-1 font-bold">{stat.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-slate-200 shadow-md bg-white rounded-2xl">
                    <CardHeader className="border-b border-slate-50">
                        <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-900">
                            <LayoutList className="h-5 w-5 text-slate-500" /> 管理模組導覽
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium">快速跳轉至核心功能設定。</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {QUICK_LINKS.map((link) => (
                                <Link 
                                    key={link.href} 
                                    href={link.href}
                                    className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xl transition-all group border-b-4 hover:border-b-primary active:translate-y-1"
                                >
                                    <link.icon className={cn("h-7 w-7 mb-2 transition-transform group-hover:scale-110", link.color)} />
                                    <span className="text-[11px] font-black text-slate-700 group-hover:text-slate-900 tracking-tight">{link.label}</span>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                        <CardHeader className="border-b border-slate-50">
                            <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-900"><Archive className="h-5 w-5 text-slate-500"/> 全域設定</CardTitle>
                            <CardDescription className="text-slate-500 font-medium">系統全站公告與設定。</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                    <Megaphone className="w-3 h-3"/> 首頁系統公告
                                </Label>
                                <textarea 
                                    className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 font-medium text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={announcement}
                                    onChange={(e) => setAnnouncement(e.target.value)}
                                    placeholder="輸入首頁顯示的跑馬燈下方的公告內容..."
                                />
                                <div className="flex justify-end">
                                    <Button 
                                        size="sm" 
                                        onClick={async () => {
                                            if (!systemConfigRef) return;
                                            await updateDoc(systemConfigRef, { announcement });
                                            toast({ title: '已儲存公告' });
                                        }}
                                        className="bg-primary text-black font-black rounded-lg"
                                    >
                                        儲存公告
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold">若留空則首頁不會顯示公告區塊。</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-md bg-white rounded-2xl">
                        <CardHeader className="border-b border-slate-50">
                            <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-900"><ShieldCheck className="h-5 w-5 text-slate-500"/> 維護開關</CardTitle>
                            <CardDescription className="text-slate-500 font-medium">控制前台模組的可用性。</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {[
                                { label: '抽卡專區', flag: 'isDrawEnabled' },
                                { label: '福袋專區', flag: 'isLuckyBagEnabled' },
                                { label: '拼卡專區', flag: 'isBettingEnabled' },
                                { label: '團拆專區', flag: 'isGroupBreakEnabled' },
                                { label: '中獎跑馬燈', flag: 'isMarqueeEnabled' },
                            ].map((feat) => (
                                <div key={feat.flag} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50/50">
                                    <span className="font-bold text-sm text-slate-800">{feat.label}</span>
                                    <Switch
                                        checked={systemConfig?.featureFlags?.[feat.flag as keyof NonNullable<SystemConfig['featureFlags']>] ?? true}
                                        onCheckedChange={(checked) => handleFeatureToggle(feat.flag as any, checked)}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {isSuperAdmin && (
                        <Card className="border-rose-200 bg-rose-50/30 rounded-2xl shadow-md">
                            <CardHeader>
                                <CardTitle className="text-sm font-black flex items-center gap-2 text-rose-700">
                                    <ShieldCheck className="h-4 w-4" /> 系統維護 (超級管理員)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <BetaWipeDialog />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
