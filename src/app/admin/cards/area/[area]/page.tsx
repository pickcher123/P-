'use client';

import { useState, useMemo, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Image as ImageIcon, Gem, ArrowLeft, Search, CheckCircle2, Loader2, Filter, UploadCloud, Files, X, Archive, LayoutGrid, Ban } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { userLevels } from '@/components/member-level-crown';

interface CardData {
    id?: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    category: string;
    sellPrice?: number;
    source?: string;
    isSold?: boolean;
    dailyLimit?: number;
    minLevel?: string;
}

const SPORT_CATEGORIES = ["全部", "籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"];

const AREA_NAMES: Record<string, string> = {
    'draw': '抽卡區域',
    'betting': '拼卡區域',
    'lucky-bag': '福袋區域',
    'group-break': '團拆區域',
    'all': '全部卡片',
};

function BulkUploadDialog({ area, onComplete }: { area: string, onComplete: () => void }) {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startBulkUpload = async () => {
        if (!firestore || !storage || selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        let successCount = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            setCurrentFileIndex(i + 1);
            const file = selectedFiles[i];
            try {
                const fileExtension = file.name.split('.').pop();
                const fileName = `P-Carder/cards/bulk-${uuidv4()}.${fileExtension}`;
                const storageRef = ref(storage, fileName);
                const uploadTask = uploadBytesResumable(storageRef, file);
                const imageUrl = await new Promise<string>((resolve, reject) => {
                    uploadTask.on('state_changed', null, reject, () => {
                        getDownloadURL(uploadTask.snapshot.ref).then(resolve);
                    });
                });
                const cardName = file.name.replace(/\.[^/.]+$/, "");
                const cardData: any = { name: cardName, imageUrl, category: '其他', sellPrice: 10, isSold: area === 'group-break' };
                if (area === 'group-break') cardData.source = 'group-break';
                await addDoc(collection(firestore, 'allCards'), cardData);
                successCount++;
                setUploadProgress(((i + 1) / selectedFiles.length) * 100);
            } catch (error) { console.error(`Failed to upload ${file.name}:`, error); }
        }
        toast({ title: "批量上傳完成", description: `成功上傳 ${successCount} 張卡片！` });
        setIsUploading(false);
        setSelectedFiles([]);
        setIsOpen(false);
        onComplete();
    };

    return (
        <>
            <Button variant="outline" onClick={() => setIsOpen(true)} className="h-10 border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50">
                <UploadCloud className="mr-2 h-4 w-4" /> 批量上傳
            </Button>
            <Dialog open={isOpen} onOpenChange={(val) => !isUploading && setIsOpen(val)}>
                <DialogContent className="light sm:max-w-xl bg-white text-slate-900 border-none shadow-2xl rounded-3xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 font-black text-xl"><Files className="h-5 w-5 text-slate-400" /> 批量卡片上傳協議</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                        {!isUploading ? (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:bg-slate-50 transition-all relative group cursor-pointer">
                                    <input type="file" multiple accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <UploadCloud className="h-12 w-12 text-slate-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                                    <p className="text-sm font-black text-slate-600">點擊或拖放圖片至此區域</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Supported: JPG, PNG, WEBP</p>
                                </div>
                                {selectedFiles.length > 0 && (
                                    <ScrollArea className="h-40 border rounded-2xl bg-slate-50 p-3 shadow-inner">
                                        <div className="space-y-1.5">
                                            {selectedFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 text-xs shadow-sm">
                                                    <span className="truncate flex-1 mr-4 font-bold text-slate-700">{file.name}</span>
                                                    <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        ) : (
                            <div className="py-10 text-center space-y-6">
                                <Loader2 className="h-12 w-12 animate-spin text-slate-900 mx-auto" />
                                <div className="space-y-2">
                                    <p className="font-black text-slate-900">正在處理第 {currentFileIndex} 張 / 共 {selectedFiles.length} 張</p>
                                    <Progress value={uploadProgress} className="h-2 w-64 mx-auto bg-slate-100" indicatorClassName="bg-slate-900" />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-3">
                        <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isUploading} className="font-bold">取消操作</Button>
                        <Button onClick={startBulkUpload} disabled={isUploading || selectedFiles.length === 0} className="px-10 font-black bg-slate-900 text-white rounded-xl shadow-xl hover:bg-slate-800">
                            {isUploading ? "系統上傳中..." : "確認開始上傳"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function CardAreaManagementPage() {
  const params = useParams();
  const area = params.area as string;
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState<Partial<CardData>>({ name: '', category: '其他', sellPrice: 10, isSold: false, dailyLimit: 0, minLevel: '新手收藏家' });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedBackFile, setSelectedBackFile] = useState<File | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [backUploadProgress, setBackUploadProgress] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('全部');
  const [activeTab, setActiveTab] = useState('active');

  const { data: allCards, isLoading: isLoadingCards, forceRefetch } = useCollection<CardData>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));
  const { data: cardPools } = useCollection<{cards?: {cardId: string}[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: bettingItems } = useCollection<{allCardIds: string[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<{prizes?: any, otherPrizes?: {cardId: string}[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  const cardAssignmentMap = useMemo(() => {
    const map = new Map<string, { type: string, name: string }>();
    
    cardPools?.forEach((p: any) => {
        p.cards?.forEach((c: any) => map.set(c.cardId, { type: 'cardPool', name: p.name || '卡池' }));
        if (p.lastPrizeCardId) map.set(p.lastPrizeCardId, { type: 'cardPool', name: (p.name || '卡池') + ' (最後賞)' });
    });

    bettingItems?.forEach((item: any) => {
        item.allCardIds?.forEach((id: string) => map.set(id, { type: 'betting', name: item.id || '競猜' }));
    });

    luckBags?.forEach((bag: any) => {
        if (bag.prizes?.first) map.set(bag.prizes.first, { type: 'luckyBag', name: bag.name || '福袋' });
        if (bag.prizes?.second) map.set(bag.prizes.second, { type: 'luckyBag', name: bag.name || '福袋' });
        if (bag.prizes?.third) map.set(bag.prizes.third, { type: 'luckyBag', name: bag.name || '福袋' });
        bag.otherPrizes?.forEach((p: any) => {
            if (p.cardId) map.set(p.cardId, { type: 'luckyBag', name: bag.name || '福袋' });
        });
    });

    return map;
  }, [cardPools, bettingItems, luckBags]);

  const filteredCards = useMemo(() => {
    if (!allCards) return [];
    let cards = [...allCards];
    const allCardIdSet = new Set(allCards.map(c => c.id));

    if (area === 'draw') {
        const ids = new Set<string>();
        cardPools?.forEach(p => p.cards?.forEach(c => {
            if (allCardIdSet.has(c.cardId)) ids.add(c.cardId);
        }));
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'betting') {
        const ids = new Set<string>();
        bettingItems?.forEach(i => i.allCardIds?.forEach(id => {
            if (allCardIdSet.has(id)) ids.add(id);
        }));
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'lucky-bag') {
        const ids = new Set<string>();
        luckBags?.forEach(b => {
            if(b.prizes?.first && allCardIdSet.has(b.prizes.first)) ids.add(b.prizes.first);
            if(b.prizes?.second && allCardIdSet.has(b.prizes.second)) ids.add(b.prizes.second);
            if(b.prizes?.third && allCardIdSet.has(b.prizes.third)) ids.add(b.prizes.third);
            b.otherPrizes?.forEach(p => {
                if (allCardIdSet.has(p.cardId)) ids.add(p.cardId);
            });
        });
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'group-break') {
        cards = cards.filter(c => c.source === 'group-break');
    }
    
    if (searchTerm.trim()) cards = cards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sportFilter !== '全部') cards = cards.filter(c => c.category === sportFilter);
    if (activeTab === 'active') cards = cards.filter(c => !c.isSold);
    else cards = cards.filter(c => c.isSold);
    
    return cards.sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards, area, cardPools, bettingItems, luckBags, searchTerm, sportFilter, activeTab]);

  const handleSaveCard = async () => {
    if (!firestore || !currentCard.name || !storage) return;
    try {
        let imageUrl = currentCard.imageUrl || '';
        let backImageUrl = currentCard.backImageUrl || '';
        if (selectedFile) {
            const storageRef = ref(storage, `P-Carder/cards/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);
            imageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
            });
        }
        if (selectedBackFile) {
            const backStorageRef = ref(storage, `P-Carder/cards/${uuidv4()}-back`);
            const backUploadTask = uploadBytesResumable(backStorageRef, selectedBackFile);
            backImageUrl = await new Promise((resolve, reject) => {
                backUploadTask.on('state_changed', (s) => setBackUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(backUploadTask.snapshot.ref).then(resolve));
            });
        }
        const cardData: any = { name: currentCard.name, category: currentCard.category, sellPrice: currentCard.sellPrice || 0, imageUrl, backImageUrl, isSold: currentCard.isSold || false, dailyLimit: Number(currentCard.dailyLimit || 0), minLevel: currentCard.minLevel || '新手收藏家' };
        if (!isEditMode && area === 'group-break') { cardData.source = 'group-break'; cardData.isSold = true; }
        if (isEditMode && currentCard.id) await updateDoc(doc(firestore, 'allCards', currentCard.id), cardData);
        else await addDoc(collection(firestore, 'allCards'), cardData);
        setIsCardDialogOpen(false); setUploadProgress(null); setBackUploadProgress(null); setSelectedFile(null); setSelectedBackFile(null);
        toast({ title: "成功" });
    } catch (e) { toast({ variant: "destructive" }); }
  };

  const handleToggleSold = async (card: CardData) => {
    if (!firestore || !card.id) return;
    try { await updateDoc(doc(firestore, 'allCards', card.id), { isSold: !card.isSold }); toast({ title: '狀態已更新' }); } catch (e) { console.error(e); toast({ variant: 'destructive' }); }
  };

  const handleDeleteCard = async (card: CardData) => {
    if (!firestore || !card.id || !storage) return;
    
    if (cardAssignmentMap.has(card.id)) {
        toast({ 
            variant: "destructive", 
            title: "無法刪除", 
            description: `此卡片目前已分配至「${cardAssignmentMap.get(card.id)?.name}」，請先從該處移除後再行刪除。` 
        });
        return;
    }

    try {
        if (card.imageUrl && card.imageUrl.includes('firebasestorage.googleapis.com')) {
            try { await deleteObject(ref(storage, card.imageUrl)); } catch (err) { console.error(err); }
        }
        await deleteDoc(doc(firestore, 'allCards', card.id));
        toast({ title: "已刪除" });
    } catch (e) { toast({ variant: "destructive" }); }
  }

  return (
    <div className="space-y-8 text-slate-900">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
            <div>
                <button onClick={() => router.push('/admin/cards')} className="flex items-center gap-2 mb-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-black uppercase tracking-widest">
                    <ArrowLeft className="h-4 w-4" /> 返回區域選擇
                </button>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    {AREA_NAMES[area] || '區域管理'}
                    <Badge className="bg-slate-900 text-white font-code px-3 ml-2">{filteredCards.length} ITEMS</Badge>
                </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="搜尋卡片名稱..." className="pl-10 h-10 bg-white border-slate-200 rounded-xl shadow-sm font-bold text-slate-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Select value={sportFilter} onValueChange={setSportFilter}>
                    <SelectTrigger className="w-[130px] h-10 bg-white border-slate-200 rounded-xl font-bold text-slate-700"><SelectValue placeholder="所有分類" /></SelectTrigger>
                    <SelectContent className="rounded-xl">{SPORT_CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                </Select>
                <BulkUploadDialog area={area} onComplete={() => forceRefetch && forceRefetch()} />
                <Button onClick={() => { setIsEditMode(false); setCurrentCard({name: '', category: '其他', sellPrice: 10, isSold: area === 'group-break', dailyLimit: 0, minLevel: '新手收藏家'}); setPreviewUrl(null); setBackPreviewUrl(null); setIsCardDialogOpen(true); }} className="h-10 rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-lg"><PlusCircle className="mr-2 h-4 w-4" /> 新增草稿</Button>
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-slate-200/50 p-1 rounded-2xl h-12 w-fit border border-slate-200 shadow-inner">
                <TabsTrigger value="active" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">在庫資產</TabsTrigger>
                <TabsTrigger value="sold" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">已抽出/回收</TabsTrigger>
            </TabsList>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <ScrollArea className="w-full">
                    <Table className="min-w-[800px]">
                        <TableHeader className="bg-slate-50 border-b-slate-200">
                            <TableRow>
                                <TableHead className="pl-8 text-slate-900 font-black uppercase text-[10px] tracking-widest py-5">名稱資訊</TableHead>
                                <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest text-center">分配位置</TableHead>
                                <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">運動分類</TableHead>
                                <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest text-center">視覺預覽</TableHead>
                                <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">庫存狀態</TableHead>
                                <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">卡片價值</TableHead>
                                <TableHead className="text-right pr-8 text-slate-900 font-black uppercase text-[10px] tracking-widest">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingCards ? Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={6} className="p-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>) : 
                            filteredCards.map((card) => (
                                <TableRow key={card.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group">
                                    <TableCell className="pl-8 font-black text-slate-900 py-4">{card.name}</TableCell>
                                    <TableCell className="text-center">
                                        {cardAssignmentMap.has(card.id!) ? (
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] font-black uppercase">
                                                {cardAssignmentMap.get(card.id!)?.name}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] font-black uppercase">閒置中</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className="text-[10px] font-black border-slate-300 text-slate-700 bg-white px-3 h-6 uppercase">{card.category}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex justify-center">
                                            <div className="relative w-10 h-14 rounded-lg border-2 border-white bg-slate-100 overflow-hidden shadow-md group-hover:scale-110 transition-all">
                                                <SafeImage src={card.imageUrl} alt="f" fill className="object-cover" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-3">
                                            <Switch checked={card.isSold} onCheckedChange={() => handleToggleSold(card)} />
                                            <Label className={cn("text-[10px] font-black uppercase tracking-tighter", card.isSold ? "text-rose-600" : "text-emerald-600")}>
                                                {card.isSold ? "已抽出" : "在庫中"}
                                            </Label>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-code font-black text-slate-900 text-lg">{card.sellPrice?.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">💎</span></TableCell>
                                    <TableCell className="text-right pr-8 space-x-1">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100" onClick={() => { setCurrentCard(card); setPreviewUrl(card.imageUrl); setBackPreviewUrl(card.backImageUrl || null); setIsEditMode(true); setIsCardDialogOpen(true); }}><Edit className="h-4 w-4 text-slate-600" /></Button>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteCard(card)}><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoadingCards && filteredCards.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-40 text-center text-slate-400 font-bold italic">
                                        <div className="flex flex-col items-center gap-3">
                                            <Archive className="h-8 w-8 opacity-20" />
                                            目前此條件下沒有卡片資產
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </Tabs>

        <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
            <DialogContent className="light sm:max-w-xl bg-white border-none shadow-2xl p-10 rounded-[2.5rem] text-slate-900 overflow-hidden">
                <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black tracking-tight">{isEditMode ? '修改資產數據' : '建立新資產草稿'}</DialogTitle></DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="grid gap-8 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">卡片名稱</Label>
                            <Input value={currentCard.name} onChange={e => setCurrentCard({...currentCard, name: e.target.value})} className="h-14 border-slate-200 rounded-2xl font-bold text-lg bg-white" placeholder="輸入完整卡片名稱" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">運動分類</Label>
                                <Select value={currentCard.category} onValueChange={v => setCurrentCard({...currentCard, category: v})}>
                                    <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">{SPORT_CATEGORIES.filter(c => c !== '全部').map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">卡片價值 (💎)</Label>
                                <Input type="number" value={currentCard.sellPrice} onChange={e => setCurrentCard({...currentCard, sellPrice: Number(e.target.value)})} className="h-12 border-slate-200 rounded-xl font-code font-black text-xl bg-white" />
                            </div>
                        </div>

                        <div className="p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 space-y-6">
                            <div className="flex items-center gap-2 text-slate-900 font-black text-sm uppercase tracking-widest">
                                <Ban className="w-4 h-4 text-rose-500" /> 參與限制 (用於拼卡專區)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">每日限購次數 (0為不限)</Label>
                                    <Input type="number" value={currentCard.dailyLimit ?? 0} onChange={e => setCurrentCard({...currentCard, dailyLimit: Number(e.target.value)})} className="h-12 border-slate-200 rounded-xl font-code font-black text-lg bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">最低等級要求</Label>
                                    <Select value={currentCard.minLevel || '新手收藏家'} onValueChange={(val) => setCurrentCard({...currentCard, minLevel: val})}>
                                        <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userLevels.map(l => <SelectItem key={l.level} value={l.level} className="font-bold">{l.level}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">正面圖片 (必填)</Label>
                                <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 rounded-xl h-10 file:font-black bg-white" />
                                {previewUrl && <div className="aspect-[2.5/3.5] relative rounded-2xl border-2 border-slate-100 bg-slate-50 overflow-hidden mt-3 shadow-md"><SafeImage src={previewUrl} alt="p" fill className="object-contain p-2" /></div>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">背面圖片 (選填)</Label>
                                <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedBackFile(e.target.files[0]); setBackPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 rounded-xl h-10 file:font-black bg-white" />
                                {backPreviewUrl && <div className="aspect-[2.5/3.5] relative rounded-2xl border-2 border-slate-100 bg-slate-50 overflow-hidden mt-3 shadow-md"><SafeImage src={backPreviewUrl} alt="p" fill className="object-contain p-2" /></div>}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-6"><Button onClick={handleSaveCard} className="w-full h-14 rounded-2xl font-black bg-slate-900 text-white text-lg shadow-xl hover:bg-slate-800 transition-all">儲存資產並同步資料庫</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
