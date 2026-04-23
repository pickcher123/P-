
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Gem, Truck, User as UserIcon, Loader2, History, MapPin, ChevronRight, Settings, Sparkles, CheckCircle2, Crown, Package, AlertCircle } from 'lucide-react';
import { PPlusIcon } from "@/components/icons";
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, writeBatch, serverTimestamp, increment, query, where, updateDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProfile } from "@/types/user-profile";
import type { SystemConfig } from "@/types/system";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MemberLevelCrown } from "@/components/member-level-crown";
import Link from "next/link";

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

interface ShippedCard {
    cardId: string;
    rarity: string;
    isFoil: boolean;
    category: string;
}
interface ShippingOrder {
    id: string;
    userId: string;
    cardIds: ShippedCard[];
    cardCount: number;
    name: string;
    phone: string;
    address: string;
    status: OrderStatus;
    shippingMethod: '7-11' | '郵寄' | '面交自取';
    createdAt: { seconds: number };
    trackingNumber?: string;
    fee: number;
}

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    currency?: 'diamond' | 'p-point';
    transactionType: 'Purchase' | 'Deposit' | 'Withdrawal' | 'QuickSell' | 'Refund' | 'Issuance';
    section?: 'draw' | 'lucky-bag' | 'betting' | 'admin' | 'shipping' | 'group-break' | 'deposit' | 'arena';
    details?: string;
}

const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'destructive',
    processing: 'default',
    shipped: 'secondary',
    cancelled: 'outline',
}

const statusText: Record<OrderStatus, string> = {
    pending: '待處理',
    processing: '處理中',
    shipped: '已出貨',
    cancelled: '已取消',
}

function translateDetails(details?: string): string {
    if (typeof details !== 'string' || !details) return '-';
    
    let match = details.match(/^Draw (\d+) from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池抽 ${match[1]} 次`;
    
    match = details.match(/^Won (.*) P-Points from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池贏得 ${match[1]} P+`;
    
    match = details.match(/^Bet on (.*)\. Currency: (.*)\. Spots: \[(.*)\]\. Result: (.*)\. Win: (.*)$/);
    if (match) {
        const [_, cardName, currency, spots, result, didWin] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P+';
        const winText = didWin === 'true' ? '中獎' : '未中獎';
        return `拼卡「${cardName}」(${curName})。選號: [${spots}]。結果: ${result} (${winText})`;
    }
    
    match = details.match(/^Direct purchase of card: (.*) via (.*)$/);
    if (match) {
        const [_, cardName, currency] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P+';
        return `直購卡片: ${cardName} (${curName})`;
    }
    
    match = details.match(/^Purchased (\d+) spots in Luck Bag: (.*)$/);
    if (match) return `購買「${match[2]}」福袋 ${match[1]} 格`;
    
    if (details.startsWith('Refund for cancelled shipping order')) return '取消運單退款';
    
    match = details.match(/^Quick sold (\d+) cards\.$/);
    if (match) return `快速轉點 ${match[1]} 張卡片`;
    
    if (details.startsWith('快速轉點')) return details;
    if (details.startsWith('紅利兌換:')) return details;
    if (details.startsWith('運單手續費')) return '出貨運費支付';
    if (details.startsWith('線上儲值')) return details;
    if (details.startsWith('管理員手動調整')) return details;
    if (details.startsWith('獲得福袋大獎')) return details;
    if (details.startsWith('獲得福袋獎項')) return details;
    if (details.startsWith('PAYUNi TradeNo:')) return '線上儲值成功';
    
    return details;
}

function ShippingOrdersTab({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCancelling, setIsCancelling] = useState<string | null>(null);

    const shippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('userId', '==', userId));
    }, [firestore, userId]);
    const { data: orders, isLoading, forceRefetch } = useCollection<ShippingOrder>(shippingQuery);
    
    const sortedOrders = useMemo(() => orders ? [...orders].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) : [], [orders]);

    const handleCancelOrder = async (order: ShippingOrder) => {
        if (!firestore || !userId || order.status !== 'pending') return;
        setIsCancelling(order.id);
        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'shippingOrders', order.id), { status: 'cancelled' });
            if ((order.fee || 0) > 0) {
              batch.update(doc(firestore, 'users', userId), { points: increment(order.fee) });
              batch.set(doc(collection(firestore, 'transactions')), { userId, transactionType: 'Refund', section: 'shipping', currency: 'diamond', amount: order.fee, details: `取消運單 ${order.id} 退款`, transactionDate: serverTimestamp() });
            }
            for (const cardInfo of order.cardIds) {
                batch.set(doc(collection(firestore, 'users', userId, 'userCards')), { cardId: (cardInfo as any).cardId, userId, isFoil: (cardInfo as any).isFoil, rarity: (cardInfo as any).rarity, category: (cardInfo as any).category });
            }
            await batch.commit();
            toast({ title: '成功', description: '訂單已取消，鑽石與卡片已退回。' });
            if (forceRefetch) forceRefetch();
        } catch (e) { toast({ variant: 'destructive', title: '錯誤' }); } finally { setIsCancelling(null); }
    };

    return (
        <Card className="border-white/5 bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/20 pb-4"><CardTitle className="text-lg flex items-center gap-2"><Truck className="h-5 w-5 text-primary"/> 出貨進度查詢</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <Table className="min-w-[500px] md:min-w-full">
                        <TableHeader className="bg-muted/10"><TableRow className="border-white/5"><TableHead className="pl-6">張數</TableHead><TableHead>申請時間</TableHead><TableHead>狀態</TableHead><TableHead className="text-right pr-6">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full"/></TableCell></TableRow> : 
                        sortedOrders.map(order => (
                            <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="pl-6 font-bold">{order.cardCount} 張</TableCell>
                                <TableCell className="text-[10px] text-muted-foreground font-code">{format(new Date(order.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')}</TableCell>
                                <TableCell><Badge variant={statusVariant[order.status] || 'default'} className="text-[9px] uppercase tracking-tighter font-black">{statusText[order.status]}</Badge></TableCell>
                                <TableCell className="text-right pr-6">{order.status === 'pending' && <Button variant="ghost" size="sm" onClick={() => handleCancelOrder(order)} disabled={!!isCancelling} className="text-xs text-destructive hover:bg-destructive/10">取消申請</Button>}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && sortedOrders.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">目前暫無出貨紀錄</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function TransactionsTab({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const transactionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'transactions'), where('userId', '==', userId)) : null, [firestore, userId]);
    const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);
    const sorted = useMemo(() => transactions ? [...transactions].sort((a, b) => b.transactionDate.seconds - a.transactionDate.seconds).slice(0, 30) : [], [transactions]);

    return (
        <Card className="border-white/5 bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/20 pb-4"><CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5 text-primary"/> 最近 30 筆交易明細</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <Table className="min-w-[600px] md:min-w-full">
                        <TableHeader className="bg-muted/10"><TableRow className="border-white/5"><TableHead className="pl-6">詳情內容</TableHead><TableHead>變動金額</TableHead><TableHead className="pr-6">交易時間</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={3} className="p-6"><Skeleton className="h-10 w-full"/></TableCell></TableRow> :
                        sorted.map(tx => (
                            <TableRow key={tx.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="pl-6 text-xs max-w-[300px] truncate leading-relaxed">{translateDetails(tx.details)}</TableCell>
                                <TableCell className={cn("font-code text-sm font-black", tx.amount > 0 ? "text-green-400" : "text-white")}>
                                    <div className="flex items-center gap-1">
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                        {tx.currency === 'p-point' ? <PPlusIcon className="h-3 w-3" /> : <Gem className="h-3 w-3 text-primary"/>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground font-code pr-6">{format(new Date(tx.transactionDate.seconds * 1000), 'MM-dd HH:mm')}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && sorted.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">目前尚無交易紀錄</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ProfilePage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    
    const [username, setUsername] = useState('');
    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    useEffect(() => {
        if (userProfile) {
            setUsername(userProfile.username || '');
            setRealName(userProfile.realName || '');
            setPhone(userProfile.phone || '');
            setAddress(userProfile.address || ''); 
        }
    }, [userProfile]);

    useEffect(() => {
        if (!isUserLoading && !user) router.push('/login');
    }, [isUserLoading, user, router]);

        const handleSaveChanges = async () => {
            if (!userProfileRef || !userProfile) return;
            
            const trimmedUsername = username.trim();
            if (trimmedUsername.length < 2 || trimmedUsername.length > 12) {
                toast({ variant: "destructive", title: "修改失敗", description: "會員名稱長度限定為 2 ~ 12 個字。" });
                return;
            }

            try {
                const updates: any = { realName, phone, address };
                
                if (trimmedUsername !== userProfile.username) {
                    if (userProfile.hasChangedUsername) {
                        toast({ variant: "destructive", title: "修改失敗", description: "會員名稱僅限修改一次。" });
                        return;
                    }
                    
                    // 檢查名稱是否重複
                    const q = query(collection(firestore, 'users'), where('username', '==', trimmedUsername));
                    const snapshot = await getDocs(q);
                    const isDuplicate = snapshot.docs.some(doc => doc.id !== user.uid);
                    
                    if (isDuplicate) {
                        toast({ variant: "destructive", title: "修改失敗", description: "此會員名稱已被使用。" });
                        return;
                    }

                    updates.username = trimmedUsername;
                    updates.hasChangedUsername = true;
                }

                await updateDoc(userProfileRef, updates);
                toast({ title: "成功", description: "個人資料已更新。" });
            } catch (e) { toast({ variant: "destructive", title: "錯誤" }); }
        };

    const currentBenefit = useMemo(() => {
        if (!userProfile || !systemConfig?.levelBenefits) return null;
        return systemConfig.levelBenefits.find(b => b.level === userProfile.userLevel);
    }, [userProfile, systemConfig]);

    if (isUserLoading || isProfileLoading || !user || !userProfile) {
        return (
            <div className="container py-32 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-12 w-12 text-primary" />
                <p className="font-headline tracking-widest text-muted-foreground animate-pulse">正在讀取會員數據庫...</p>
            </div>
        );
    }

    return (
        <div className="container py-12 md:py-20 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary/5 blur-[100px] pointer-events-none" />

            <div className="text-center mb-16 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-[0.3em] mb-4 uppercase animate-fade-in-up">
                    <Shield className="w-3 h-3" /> 會員榮耀中心
                </div>
                <h1 className="font-headline text-4xl font-black tracking-[0.2em] sm:text-6xl text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] mb-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    會員中心
                </h1>
                <p className="text-muted-foreground font-medium animate-fade-in-up" style={{ animationDelay: '200ms' }}>管理個人資料、追蹤物流進度並查詢點數異動。</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="lg:col-span-1 space-y-6">
                    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/20 via-card/80 to-background rounded-[2.5rem] shadow-2xl group">
                        <CardContent className="pt-10 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Crown className="w-24 h-24 text-primary" /></div>
                            <div className="relative group/avatar mb-4">
                                <div className="absolute -inset-12 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity animate-pulse" />
                                <MemberLevelCrown level={userProfile.userLevel} size="lg" />
                            </div>
                            <h2 className="text-3xl font-black font-headline mt-6 tracking-tight text-white drop-shadow-md">{userProfile.username}</h2>
                            <div className="mt-2 flex items-center gap-2 bg-primary/10 px-4 py-1 rounded-full border border-primary/20">
                                <Crown className="h-3 w-3 text-accent fill-accent animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{userProfile.userLevel}</span>
                            </div>

                            {currentBenefit && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2 animate-fade-in-up">
                                    {currentBenefit.freeShipping && (
                                        <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1">
                                            <Truck className="w-3 h-3 mr-1" /> 免運特權
                                        </Badge>
                                    )}
                                    {currentBenefit.cashbackRate > 0 && (
                                        <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-[9px] font-black uppercase tracking-widest px-2.5 py-1">
                                            <PPlusIcon className="w-3 h-3 mr-1" /> 回饋率 {currentBenefit.cashbackRate}%
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <Button variant="link" asChild className="text-primary font-bold mt-6 h-auto p-0 hover:text-white transition-colors">
                                <Link href="/vip" className="flex items-center gap-1 text-xs tracking-widest">查看 VIP 階級特權 <ChevronRight className="h-4 w-4"/></Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4">
                        <Card className="bg-card/30 backdrop-blur-xl border-white/5 rounded-[2rem] overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20"><Gem className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"/></div>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">鑽石餘額</span>
                                    </div>
                                    <span className="font-black font-code text-2xl text-white">{userProfile.points?.toLocaleString() || 0}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/30 backdrop-blur-xl border-white/5 rounded-[2rem] overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20"><PPlusIcon className="h-5 w-5" /></div>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">紅利 P+</span>
                                    </div>
                                    <span className="font-black font-code text-2xl text-accent">{userProfile.bonusPoints?.toLocaleString() || 0}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-2">
                     <Tabs defaultValue="settings" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/20 p-1.5 rounded-2xl h-14 border border-white/5 backdrop-blur-md">
                            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"><Settings className="mr-2 h-4 w-4"/> 基本資料</TabsTrigger>
                            <TabsTrigger value="transactions" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"><History className="mr-2 h-4 w-4"/> 消費紀錄</TabsTrigger>
                            <TabsTrigger value="shipping" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold transition-all"><Truck className="mr-2 h-4 w-4"/> 出貨管理</TabsTrigger>
                        </TabsList>

                        <TabsContent value="settings" className="animate-in fade-in slide-in-from-top-2 duration-500">
                             <Card className="border-white/5 bg-card/30 backdrop-blur-xl rounded-[2.5rem] shadow-2xl">
                                <CardHeader className="p-8 pb-4">
                                    <CardTitle className="text-xl font-black font-headline flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary"/> 個人資料修改</CardTitle>
                                    <CardDescription>請務必提供正確的收件資訊，以確保卡片能準確寄送至您的手中。</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-4 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="username" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">會員名稱</Label>
                                                {userProfile.hasChangedUsername && (
                                                    <span className="text-[10px] text-destructive font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> 已修改
                                                    </span>
                                                )}
                                            </div>
                                            <Input 
                                                id="username" 
                                                value={username} 
                                                onChange={(e) => setUsername(e.target.value)} 
                                                disabled={userProfile.hasChangedUsername}
                                                className={cn(
                                                    "h-12 bg-background/50 border-white/10 rounded-xl transition-all font-bold",
                                                    userProfile.hasChangedUsername ? "opacity-50 cursor-not-allowed" : "focus:border-primary"
                                                )} 
                                                placeholder="請輸入 2-12 位會員名稱"
                                            />
                                            {!userProfile.hasChangedUsername ? (
                                                <p className="text-[10px] text-primary/80 font-bold bg-primary/5 p-2 rounded-lg border border-primary/10">
                                                    <Sparkles className="w-3 h-3 inline mr-1" /> 
                                                    注意：會員名稱限修改 <span className="text-primary underline">一次</span>，長度限定為 <span className="text-primary underline">2 ~ 12</span> 個字。
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground font-medium italic">您已使用過更名機會。</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="realName" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">收件姓名 (真實姓名)</Label>
                                            <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="用於物流核對身份" className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">聯絡電話</Label>
                                            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="address" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">預設收件地址 / 7-11 門市</Label>
                                            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例如：7-11 台北門市" className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all" />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-white/5 space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Shield className="w-4 h-4"/>
                                            <span className="text-[10px] font-black uppercase tracking-widest">帳戶安全標籤 (UID)</span>
                                        </div>
                                        <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                            <code className="text-[10px] font-mono text-primary/60 break-all">{userProfile.id}</code>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveChanges} className="w-full sm:w-auto h-12 px-10 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95 transition-all">
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> 儲存變更內容
                                    </Button>
                                </CardContent>
                             </Card>
                        </TabsContent>

                        <TabsContent value="transactions" className="animate-in fade-in slide-in-from-top-2 duration-500">
                           <TransactionsTab userId={user.uid} />
                        </TabsContent>
                        
                        <TabsContent value="shipping" className="animate-in fade-in slide-in-from-top-2 duration-500">
                           <ShippingOrdersTab userId={user.uid} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
