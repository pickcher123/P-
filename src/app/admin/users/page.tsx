'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, writeBatch, serverTimestamp, increment, where, limit } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/types/user-profile';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Edit, Loader2, Shield, History, Truck, User as UserIcon, Gem, MapPin, Search, UserCircle, Crown, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MemberLevelCrown } from '@/components/member-level-crown';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PPlusIcon } from '@/components/icons';

const PERMISSION_ITEMS = [
    { id: 'reports', label: '營業報表' },
    { id: 'cards', label: '卡片總管' },
    { id: 'card-pools', label: '抽卡管理' },
    { id: 'lucky-bags', label: '福袋管理' },
    { id: 'betting', label: '拼卡管理' },
    { id: 'group-breaks', label: '團拆管理' },
    { id: 'news', label: '消息管理' },
    { id: 'rewards', label: '會員回饋' },
    { id: 'users', label: '會員資訊' },
    { id: 'orders', label: '交易紀錄' },
    { id: 'shipping', label: '出貨管理' },
    { id: 'deposits', label: '儲值管理' },
    { id: 'conversions', label: '轉點紀錄' },
    { id: 'materials', label: '素材管理' },
];

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';

function translateDetails(details?: string): string {
    if (typeof details !== 'string' || !details) return '-';
    return details;
}

interface Transaction {
    id: string;
    userId: string;
    transactionDate: any;
    amount: number;
    currency?: 'diamond' | 'p-point';
    transactionType: string;
    details?: string;
}

interface ShippingOrder {
    id: string;
    userId: string;
    cardCount: number;
    shippingMethod: string;
    status: string;
    trackingNumber?: string;
    createdAt: any;
}

function UserDetailsDialog({ user }: { user: UserProfile }) {
    const firestore = useFirestore();
    const [isOpen, setIsOpen] = useState(false);

    const txQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'transactions'), where('userId', '==', user.id));
    }, [firestore, user.id, isOpen]);
    const { data: rawTransactions, isLoading: isLoadingTx } = useCollection<Transaction>(txQuery);

    const sortedTransactions = useMemo(() => {
        if (!rawTransactions) return [];
        return [...rawTransactions].sort((a, b) => (b.transactionDate?.seconds || 0) - (a.transactionDate?.seconds || 0));
    }, [rawTransactions]);

    const shippingQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'shippingOrders'), where('userId', '==', user.id));
    }, [firestore, user.id, isOpen]);
    const { data: rawOrders, isLoading: isLoadingShipping } = useCollection<ShippingOrder>(shippingQuery);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-xl transition-all">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="font-bold text-slate-900 truncate max-w-[120px] md:max-w-full">{user.username}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{user.email}</p>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl text-slate-900">
                <DialogHeader className="p-4 md:p-8 pb-3 md:pb-4 bg-slate-50 border-b border-slate-100">
                    <DialogTitle className="flex items-center gap-3 text-lg md:text-xl font-black text-slate-900">
                        <UserIcon className="text-slate-400 h-5 w-5" /> 會員詳細資料
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="overview" className="h-full flex flex-col">
                        <div className="px-4 md:px-8 pt-4">
                            <TabsList className="bg-slate-100 min-h-[44px] w-full grid grid-cols-3 rounded-lg p-1">
                                <TabsTrigger value="overview" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">帳戶概覽</TabsTrigger>
                                <TabsTrigger value="transactions" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">交易紀錄</TabsTrigger>
                                <TabsTrigger value="shipping" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">物流訂單</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="overview" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8 space-y-6 text-slate-900">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <Card className="p-6 text-center rounded-2xl border-slate-200 bg-white shadow-sm flex flex-col items-center">
                                            <MemberLevelCrown level={user.userLevel} size="sm" showLabel />
                                            <h3 className="mt-4 font-black text-lg text-slate-900 break-all">{user.username}</h3>
                                            <Badge variant="outline" className="mt-2 text-[10px] uppercase font-black text-slate-600 border-slate-300">{user.role}</Badge>
                                            <div className="mt-6 w-full space-y-3 text-xs">
                                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                                    <span className="text-slate-500 font-black uppercase text-[9px]">註冊日期</span>
                                                    <span className="font-code font-bold text-slate-700">{user.createdAt ? format((user.createdAt as any).toDate(), 'yyyy-MM-dd') : '-'}</span>
                                                </div>
                                                <div className="text-left"><p className="text-slate-500 text-[9px] font-black uppercase mb-1">UID</p><p className="font-mono text-[10px] font-bold break-all bg-slate-50 p-2 rounded border border-slate-100">{user.id}</p></div>
                                            </div>
                                        </Card>

                                        <div className="md:col-span-2 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                                                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">鑽石資產</p>
                                                    <p className="text-2xl font-black font-code flex items-center justify-center gap-2 text-cyan-700">
                                                        {user.points?.toLocaleString() || 0} <Gem className="w-5 h-5 text-cyan-600" />
                                                    </p>
                                                </div>
                                                <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                                                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">紅利 P 點</p>
                                                    <p className="text-2xl font-black font-code text-amber-700 flex items-center justify-center gap-2">
                                                        {user.bonusPoints?.toLocaleString() || 0} <PPlusIcon className="w-5 h-5" />
                                                    </p>
                                                </div>
                                            </div>

                                            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden text-slate-900">
                                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">配送資訊</span>
                                                </div>
                                                <CardContent className="p-6 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-1"><p className="text-slate-500 text-[9px] uppercase font-black">收件姓名</p><p className="font-black text-slate-900">{user.realName || '未填寫'}</p></div>
                                                        <div className="space-y-1"><p className="text-slate-500 text-[9px] uppercase font-black">聯絡電話</p><p className="font-bold font-code text-slate-900">{user.phone || '未填寫'}</p></div>
                                                    </div>
                                                    <div className="space-y-1 pt-4 border-t border-slate-100 items-start flex flex-col"><p className="text-slate-500 text-[9px] uppercase font-black">預設配送地址</p><p className="font-bold text-sm leading-relaxed text-slate-800 text-left">{user.address || '未設定'}</p></div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="transactions" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8">
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <Table className="min-w-[500px]">
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                    <TableRow className="border-b-slate-200">
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest pl-6">交易詳情</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">變動</TableHead>
                                                        <TableHead className="text-right text-[10px] font-black text-slate-900 uppercase tracking-widest pr-6">日期時間</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoadingTx ? (
                                                        <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300"/></TableCell></TableRow>
                                                    ) : (
                                                        sortedTransactions.map(tx => (
                                                            <TableRow key={tx.id} className="hover:bg-slate-50 border-b-slate-100">
                                                                <TableCell className="text-xs font-bold text-slate-700 pl-6">{translateDetails(tx.details)}</TableCell>
                                                                <TableCell className={cn("font-code font-black text-sm", tx.amount > 0 ? "text-emerald-700" : "text-slate-900")}>
                                                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}{tx.currency === 'p-point' ? 'P' : '💎'}
                                                                </TableCell>
                                                                <TableCell className="text-[10px] text-slate-500 font-bold text-right pr-6">
                                                                    {tx.transactionDate ? format((tx.transactionDate as any).toDate(), 'MM-dd HH:mm') : '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="shipping" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8">
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <Table className="min-w-[500px]">
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                    <TableRow className="border-b-slate-200">
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest pl-6">日期</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">數量</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">狀態</TableHead>
                                                        <TableHead className="text-right text-[10px] font-black text-slate-900 uppercase tracking-widest pr-6">單號</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoadingShipping ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300"/></TableCell></TableRow>
                                                    ) : (
                                                        rawOrders?.map(order => (
                                                            <TableRow key={order.id} className="hover:bg-slate-50 border-b-slate-100">
                                                                <TableCell className="text-[10px] font-code text-slate-600 font-bold pl-6">{order.createdAt ? format((order.createdAt as any).toDate(), 'MM-dd') : '-'}</TableCell>
                                                                <TableCell className="text-xs font-black text-slate-900">{order.cardCount} 張</TableCell>
                                                                <TableCell><Badge variant="secondary" className="text-[9px] h-5 uppercase font-black bg-slate-900 text-white border-none">{order.status}</Badge></TableCell>
                                                                <TableCell className="text-[10px] text-right font-mono text-cyan-700 font-black pr-6">{order.trackingNumber || '--'}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full h-12 rounded-xl font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-100 transition-all">關閉詳細資料</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ToggleRoleDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleToggle = async () => {
        if (!firestore) return;
        setIsProcessing(true);
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            await updateDoc(doc(firestore, 'users', user.id), { role: newRole });
            toast({ title: '角色已變更' });
            onUpdate();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '變更失敗' });
        } finally { setIsProcessing(false); }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all">
                    變更角色
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black text-slate-900 tracking-tight">系統角色權限變更</AlertDialogTitle>
                    <AlertDialogDescription className="font-bold text-slate-600">
                        確定要將 「{user.username}」 從 {user.role} 變更為 {user.role === 'admin' ? '一般會員' : '管理員'} 嗎？<br/>這將影響該帳戶對後台功能的存取能力。
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggle} disabled={isProcessing} className="rounded-xl bg-slate-900 text-white font-black px-8">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : '確認執行變更'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function ModifyPermissionsDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [permissions, setPermissions] = useState(user.permissions || []);
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleConfirm = async () => {
        if(!firestore) return;
        setIsProcessing(true);
        try {
            await updateDoc(doc(firestore, 'users', user.id), { permissions });
            toast({ title: '權限已更新' });
            onUpdate();
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '設定失敗' });
        } finally { setIsProcessing(false); }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700">模組授權</Button></DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border-none text-slate-900 p-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-6 border-b border-slate-50">
                    <DialogTitle className="text-xl font-black text-slate-900">管理模組授權 - {user.username}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 py-4">
                            {PERMISSION_ITEMS.map(item => (
                                <div key={item.id} className="flex items-center space-x-2 p-3.5 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group hover:border-slate-300 shadow-sm">
                                    <Checkbox id={`p-${item.id}`} checked={permissions.includes(item.id)} onCheckedChange={(c) => setPermissions(prev => c ? [...prev, item.id] : prev.filter(p => p !== item.id))} />
                                    <Label htmlFor={`p-${item.id}`} className="text-xs cursor-pointer font-bold text-slate-700 group-hover:text-slate-900">{item.label}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 border-t border-slate-50">
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full rounded-2xl h-14 font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800">{isProcessing ? <Loader2 className="animate-spin"/> : '儲存授權設定'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ModifyPointsDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [points, setPoints] = useState(0);
    const [currency, setCurrency] = useState<'diamond' | 'p-point'>('diamond');
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleConfirm = async () => {
        if (!firestore || points === 0) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', user.id);
            const field = currency === 'diamond' ? 'points' : 'bonusPoints';
            batch.update(userRef, { [field]: increment(points) });
            batch.set(doc(collection(firestore, 'transactions')), { 
                userId: user.id, 
                transactionType: 'Deposit', 
                amount: points, 
                currency, 
                section: 'admin', 
                details: `管理員手動調整 (${currency === 'diamond' ? '鑽石' : 'P點'})`, 
                transactionDate: serverTimestamp() 
            });
            await batch.commit();
            toast({ title: '點數已更新' });
            onUpdate(); setIsOpen(false); setPoints(0);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: '調整失敗' });
        } finally { setIsProcessing(false); }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700">資產修正</Button></DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-md max-h-[90vh] rounded-3xl bg-white shadow-2xl border-none p-0 flex flex-col overflow-hidden text-slate-900">
                <DialogHeader className="p-6 md:p-8 pb-3 md:pb-4 text-center border-b border-slate-50">
                    <DialogTitle className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-widest italic">資產手動修正協議</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6 md:p-8">
                        <div className="space-y-6 md:space-y-8">
                            <RadioGroup value={currency} onValueChange={(v: any) => setCurrency(v)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                                <div className={cn("flex flex-col items-center gap-3 p-4 md:p-6 border-2 rounded-2xl cursor-pointer transition-all", currency === 'diamond' ? 'border-cyan-600 bg-cyan-50 shadow-lg' : 'border-slate-100 bg-slate-50 opacity-60')}>
                                    <RadioGroupItem value="diamond" id="dia" className="sr-only"/><Gem className="h-5 w-5 md:h-6 md:w-6 text-cyan-600"/><Label htmlFor="dia" className={cn("cursor-pointer font-black text-[10px] md:text-xs uppercase tracking-widest", currency === 'diamond' ? "text-slate-900" : "text-slate-400")}>鑽石資產 💎</Label>
                                </div>
                                <div className={cn("flex flex-col items-center gap-3 p-4 md:p-6 border-2 rounded-2xl cursor-pointer transition-all", currency === 'p-point' ? 'border-amber-600 bg-amber-50 shadow-lg' : 'border-slate-100 bg-slate-50 opacity-60')}>
                                    <RadioGroupItem value="p-point" id="pt" className="sr-only"/><PPlusIcon className="h-5 w-5 md:h-6 md:w-6"/><Label htmlFor="pt" className={cn("cursor-pointer font-black text-[10px] md:text-xs uppercase tracking-widest", currency === 'p-point' ? "text-slate-900" : "text-slate-400")}>紅利 P 點</Label>
                                </div>
                            </RadioGroup>
                            <div className="space-y-3">
                                <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-widest block text-center">調整數量 (正數增加，負數扣除)</Label>
                                <Input type="number" value={points || ''} onChange={(e) => setPoints(parseInt(e.target.value) || 0)} className="h-14 md:h-16 rounded-2xl text-2xl md:text-3xl font-black text-center border-slate-200 bg-white text-slate-900" placeholder="0" />
                            </div>
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 md:p-8 border-t border-slate-50">
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full rounded-2xl h-14 font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all text-lg">{isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : '確認執行資產變動'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function UsersAdminPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

  const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), limit(50)) : null, [firestore]);
  const { data: users, isLoading, forceRefetch } = useCollection<UserProfile>(usersQuery);
  
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let result = users.filter(u => !searchTerm.trim() || u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm));
    return result.sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
  }, [users, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6">
        <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">會員管理</h1>
            <p className="mt-1 text-sm text-slate-600 font-bold">查閱並管理全站會員資料與權限存取層級。</p>
        </div>
        <div className="relative w-full xl:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="搜尋名稱、Email 或 UID..." className="pl-12 h-12 bg-white border-slate-200 rounded-2xl shadow-sm font-black text-slate-900 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Card className="border-slate-200 shadow-lg overflow-hidden rounded-3xl bg-white">
        <div className="overflow-x-auto custom-scrollbar">
            <Table className="min-w-[1000px]">
            <TableHeader className="bg-slate-50">
                <TableRow className="border-b-slate-200">
                    <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">會員資訊</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">等級稱號</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">帳戶資產</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">系統角色</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-900 tracking-widest">管理操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5} className="p-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>
                )) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
                    <TableRow key={user.id} className={cn("hover:bg-slate-50/80 transition-colors border-b-slate-100", user.email === SUPER_ADMIN_EMAIL && "bg-blue-50/40")}>
                    <TableCell className="pl-8 py-5"><UserDetailsDialog user={user} /></TableCell>
                    <TableCell><Badge variant="outline" className="font-black text-[10px] border-slate-300 text-slate-700 uppercase h-6 px-3 bg-white shadow-sm">{user.userLevel}</Badge></TableCell>
                    <TableCell className="font-code">
                        <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">{user.points?.toLocaleString() || 0} <Gem className="w-3.5 h-3.5 text-cyan-600" /></span>
                            <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">{user.bonusPoints?.toLocaleString() || 0} <PPlusIcon className="w-3.5 h-3.5" /></span>
                        </div>
                    </TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className={cn("text-[9px] uppercase font-black h-5 px-2 border-none shadow-sm", user.role === 'admin' ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700")}>{user.role}</Badge></TableCell>
                    <TableCell className="text-right pr-8 py-5"><div className="flex justify-end gap-2">
                        {isSuperAdmin && user.email !== SUPER_ADMIN_EMAIL && (
                            <><ToggleRoleDialog user={user} onUpdate={() => forceRefetch?.()} />{user.role === 'admin' && <ModifyPermissionsDialog user={user} onUpdate={() => forceRefetch?.()} />}</>
                        )}
                        <ModifyPointsDialog user={user} onUpdate={() => forceRefetch?.()} />
                    </div></TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-black tracking-widest uppercase">
                            查無符合條件的會員
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </Card>
    </div>
  );
}
