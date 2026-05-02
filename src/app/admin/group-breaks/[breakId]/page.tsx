'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, addDoc, getDoc, setDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ImageIcon, Loader2, Upload, Youtube, Trash2, PlusCircle, Copy, Trophy, Check, Sparkles, Gem, Package, ShieldCheck, Search, Filter, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/types/user-profile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent as DialogContentNew, DialogHeader as DialogHeaderNew, DialogTitle as DialogTitleNew, DialogFooter as DialogFooterNew } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PPlusIcon } from '@/components/icons';

type Spot = {
  spotNumber: number;
  userId?: string;
};

type Team = {
  teamId: string;
  name: string;
  price: number;
  userId?: string;
}

interface Winnings {
    userId: string;
    username: string;
    teamId: string;
    teamName: string;
    cardId?: string;
    cardName?: string;
    cardImageUrl?: string;
}

interface GroupBreak {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pricePerSpot?: number;
  totalSpots?: number;
  youtubeUrl?: string;
  breakType: 'spot' | 'team';
  currency?: 'diamond' | 'p-point';
  status: 'draft' | 'published' | 'completed';
  isAdult?: boolean;
  winnings?: Winnings[];
  spots?: Spot[];
  teams?: Team[];
}

interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    rarity?: string;
    isSold?: boolean;
}


function PrizeAssignment({ groupBreak, groupBreakRef }: { groupBreak: GroupBreak, groupBreakRef: any }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();

    const [isPrizeDialogOpen, setIsPrizeDialogOpen] = useState(false);
    const [prizeTarget, setPrizeTarget] = useState<{userId: string, username: string, teamId: string, teamName: string} | null>(null);
    const [assignMode, setAssignMode] = useState<'upload' | 'inventory'>('upload');
    
    // Upload mode state
    const [cardName, setCardName] = useState('');
    const [cardCategory, setCardCategory] = useState('其他');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Inventory mode state
    const [inventorySearch, setInventorySearch] = useState('');
    const { data: allCards, isLoading: isLoadingInventory } = useCollection<CardData>(useMemoFirebase(() => firestore ? query(collection(firestore, 'allCards')) : null, [firestore]));

    const filteredInventory = useMemo(() => {
        if (!allCards) return [];
        return allCards.filter(c => 
            c.name.toLowerCase().includes(inventorySearch.toLowerCase()) && 
            !c.isSold
        );
    }, [allCards, inventorySearch]);

    const handleOpenPrizeDialog = (winning: Winnings) => {
        setPrizeTarget({ userId: winning.userId, username: winning.username, teamId: winning.teamId, teamName: winning.teamName });
        setIsPrizeDialogOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleAssignUploadedPrize = async () => {
        if (!firestore || !storage || !groupBreakRef || !groupBreak.winnings || !prizeTarget || !cardName || !selectedFile) return;

        setUploadProgress(0);
        try {
            const filePath = `P-Carder/cards/${uuidv4()}`;
            const fileRef = ref(storage, filePath);
            const uploadTask = uploadBytesResumable(fileRef, selectedFile);

            uploadTask.on('state_changed', 
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => { toast({ variant: 'destructive', title: '上傳失敗' }); setUploadProgress(null); },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const newCardData = { 
                        name: cardName, 
                        imageUrl: downloadURL, 
                        category: cardCategory, 
                        sellPrice: 0, 
                        source: 'group-break', 
                        isSold: true,
                        rarity: 'rare' // Default for uploaded
                    };
                    
                    const newCardRef = await addDoc(collection(firestore, 'allCards'), newCardData);
                    await processFinalAssignment(newCardRef.id, newCardData.name, newCardData.imageUrl, newCardData.category, newCardData.rarity);
                }
            );
        } catch (err) { setUploadProgress(null); }
    }

    const handleAssignInventoryPrize = async (card: CardData) => {
        if (!firestore || !groupBreakRef || !prizeTarget) return;
        await processFinalAssignment(card.id, card.name, card.imageUrl, card.category, card.rarity || 'rare');
    }

    const processFinalAssignment = async (cardId: string, name: string, imageUrl: string, category: string, rarity: string) => {
        if (!firestore || !groupBreakRef || !prizeTarget || !groupBreak.winnings) return;
        
        try {
            const batch = writeBatch(firestore);
            
            // 1. Mark original card as sold (if from inventory)
            batch.update(doc(firestore, 'allCards', cardId), { isSold: true, source: 'group-break' });

            // 2. Add to user collection
            const newUserCardRef = doc(collection(firestore, 'users', prizeTarget.userId, 'userCards'));
            batch.set(newUserCardRef, {
                cardId,
                userId: prizeTarget.userId,
                category,
                isFoil: false,
                rarity: rarity,
                source: 'group-break',
                breakTitle: groupBreak.title,
                teamName: prizeTarget.teamName,
            });

            // 3. Update group break results
            const updatedWinnings = groupBreak.winnings.map(w => 
                w.teamId === prizeTarget.teamId ? { ...w, cardId, cardName: name, cardImageUrl: imageUrl } : w
            );
            batch.update(groupBreakRef, { winnings: updatedWinnings });

            // 4. Create announcement if legendary
            if (rarity === 'legendary') {
                batch.set(doc(collection(firestore, 'announcements')), {
                    username: prizeTarget.username,
                    action: '在團拆中獲得了',
                    prize: name,
                    prizeImageUrl: imageUrl,
                    rarity: 'legendary',
                    timestamp: serverTimestamp(),
                    section: groupBreak.title
                });
            }

            await batch.commit();
            toast({ title: '派獎成功' });
            setIsPrizeDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: '處理失敗' }); }
    }

    if(groupBreak.status !== 'completed' || !groupBreak.winnings) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-muted-foreground"/> 派獎管理</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">團拆活動完成隨機配對後，即可在此處為每位中獎玩家派發實體卡片獎項。</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <>
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5" /> 派獎管理中心
                    </CardTitle>
                    <CardDescription>為每個隊伍的中獎者設定獎品。派發後，玩家收藏庫將即時出現該卡片。</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-xl bg-card/50 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">隊伍</TableHead>
                                    <TableHead>玩家</TableHead>
                                    <TableHead>獎品狀態</TableHead>
                                    <TableHead className="text-right pr-6">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupBreak.winnings.map(w => (
                                    <TableRow key={w.teamId} className="hover:bg-white/5 transition-colors">
                                        <TableCell className="font-bold pl-6">{w.teamName}</TableCell>
                                        <TableCell>{w.username}</TableCell>
                                        <TableCell>
                                            {w.cardId ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-8 h-11 border border-white/10 rounded overflow-hidden">
                                                        <Image src={w.cardImageUrl!} alt={w.cardName!} fill className="object-cover" />
                                                    </div>
                                                    <span className="text-xs font-medium text-green-400 truncate max-w-[120px]">{w.cardName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin"/> 待派發
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button size="sm" variant={w.cardId ? "outline" : "default"} onClick={() => handleOpenPrizeDialog(w)}>
                                                {w.cardId ? '更換獎品' : '派發獎品'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isPrizeDialogOpen} onOpenChange={setIsPrizeDialogOpen}>
              <DialogContentNew className="sm:max-w-2xl">
                  <DialogHeaderNew>
                      <DialogTitleNew className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-accent" /> 設定獎品 - {prizeTarget?.teamName}
                      </DialogTitleNew>
                  </DialogHeaderNew>
                  
                  <Tabs value={assignMode} onValueChange={(v: any) => setAssignMode(v)} className="py-4">
                      <TabsList className="grid w-full grid-cols-2 bg-muted h-12">
                          <TabsTrigger value="upload" className="font-bold"><Upload className="w-4 h-4 mr-2"/> 上傳新卡片</TabsTrigger>
                          <TabsTrigger value="inventory" className="font-bold"><Archive className="w-4 h-4 mr-2"/> 從庫存挑選</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload" className="space-y-6 pt-6">
                          <div className="space-y-2">
                              <Label>獎品名稱</Label>
                              <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="輸入獎品完整名稱" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>卡片分類</Label>
                                <Input value={cardCategory} onChange={e => setCardCategory(e.target.value)} placeholder="例如：籃球" />
                            </div>
                            <div className="space-y-2">
                                <Label>實體圖片</Label>
                                <Input type="file" accept="image/*" onChange={handleFileChange} />
                            </div>
                          </div>
                          {previewUrl && (
                              <div className="aspect-[2.5/3.5] relative w-32 mx-auto bg-muted rounded-xl border border-white/10 overflow-hidden">
                                  <Image src={previewUrl} alt="preview" fill className="object-cover" />
                              </div>
                          )}
                          {uploadProgress !== null && <Progress value={uploadProgress} className="h-1.5" />}
                          <Button className="w-full h-12 font-bold" onClick={handleAssignUploadedPrize} disabled={uploadProgress !== null || !cardName || !selectedFile}>
                              確認並上傳派獎
                          </Button>
                      </TabsContent>

                      <TabsContent value="inventory" className="space-y-4 pt-6">
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="搜尋庫存卡片..." className="pl-10" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                          </div>
                          <ScrollArea className="h-80 border rounded-xl p-2 bg-black/5">
                              <div className="grid grid-cols-3 gap-3">
                                  {isLoadingInventory ? <Loader2 className="animate-spin mx-auto col-span-3 my-10"/> :
                                  filteredInventory.map(card => (
                                      <div key={card.id} className="flex flex-col gap-2 p-2 border rounded-lg hover:border-primary cursor-pointer transition-all group" onClick={() => handleAssignInventoryPrize(card)}>
                                          <div className="relative aspect-[2.5/3.5] rounded bg-muted overflow-hidden">
                                              <Image src={card.imageUrl} alt={card.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                                          </div>
                                          <p className="text-[10px] font-bold truncate text-center">{card.name}</p>
                                      </div>
                                  ))}
                              </div>
                          </ScrollArea>
                      </TabsContent>
                  </Tabs>
              </DialogContentNew>
            </Dialog>
        </>
    );
}



export default function GroupBreakAdminDetailPage() {
  const { breakId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [details, setDetails] = useState<Partial<GroupBreak>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPrice, setNewTeamPrice] = useState(0);

  const groupBreakRef = useMemoFirebase(() => {
    if (!firestore || !breakId) return null;
    return doc(firestore, 'groupBreaks', breakId as string);
  }, [firestore, breakId]);

  const { data: groupBreak, isLoading: isLoadingBreak, forceRefetch } = useDoc<GroupBreak>(groupBreakRef);

  useEffect(() => {
    if (groupBreak) {
      setDetails({
        title: groupBreak.title,
        description: groupBreak.description,
        imageUrl: groupBreak.imageUrl,
        pricePerSpot: groupBreak.pricePerSpot,
        totalSpots: groupBreak.totalSpots,
        youtubeUrl: groupBreak.youtubeUrl,
        status: groupBreak.status,
        breakType: groupBreak.breakType,
        teams: groupBreak.teams,
        currency: groupBreak.currency || 'diamond',
        isAdult: groupBreak.isAdult,
      });
      setPreviewUrl(groupBreak.imageUrl);
    }
  }, [groupBreak]);

  const handleDetailChange = (field: keyof GroupBreak, value: any) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async (field: keyof GroupBreak) => {
    if (!groupBreakRef) return;
    try {
        await updateDoc(groupBreakRef, { [field]: details[field] || '' });
        toast({ title: '成功', description: `欄位 ${field} 已更新。` });
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        toast({ variant: 'destructive', title: '錯誤', description: `無法更新 ${field}。` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile || !groupBreakRef || !storage) return;
    setUploadProgress(0);
    const filePath = `P-Carder/group-breaks/${breakId}/${uuidv4()}`;
    const fileRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, selectedFile);

    uploadTask.on('state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        setUploadProgress(null);
        toast({ variant: 'destructive', title: '上傳失敗', description: error.message });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(groupBreakRef, { imageUrl: downloadURL });
        setUploadProgress(null);
        setSelectedFile(null);
        toast({ title: '成功', description: '活動主圖已更新。' });
      }
    );
  };
  
  const handleResetParticipants = async () => {
    if (!groupBreakRef || !groupBreak) return;
    
    let updateData = {};
    if (groupBreak.breakType === 'team') {
        const resetTeams = (groupBreak.teams || []).map(({userId, ...rest}) => rest);
        updateData = { teams: resetTeams };
    } else {
        const newSpots = Array.from({ length: groupBreak.totalSpots || 0 }, (_, i) => ({ spotNumber: i + 1 }));
        updateData = { spots: newSpots };
    }
    
    try {
        await updateDoc(groupBreakRef, updateData);
        toast({ title: '成功', description: '所有參與者紀錄已清除。' });
        if(forceRefetch) forceRefetch();
    } catch(e) {
        console.error("Error resetting participants", e);
        toast({ variant: 'destructive', title: '錯誤', description: '重設失敗。'})
    }
  }

  const handleAddTeam = async () => {
    if (!newTeamName.trim() || newTeamPrice <= 0 || !groupBreakRef || !groupBreak) {
        toast({variant: 'destructive', title: '錯誤', description: '請輸入有效的隊伍名稱和價格。'});
        return;
    }
    const newTeam: Team = {
        teamId: uuidv4(),
        name: newTeamName,
        price: newTeamPrice,
    };
    const updatedTeams = [...(groupBreak.teams || []), newTeam];
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        setNewTeamName('');
        setNewTeamPrice(0);
        toast({ title: '成功', description: '隊伍已新增。'});
    } catch (e) {
        console.error("Error adding team", e);
        toast({ variant: 'destructive', title: '錯誤', description: '新增隊伍失敗。'})
    }
  }

  const handleRemoveTeam = async (teamId: string) => {
    if (!groupBreakRef || !groupBreak?.teams) return;
    const updatedTeams = groupBreak.teams.filter(t => t.teamId !== teamId);
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        toast({ title: '成功', description: '隊伍已移除。'});
    } catch (e) {
        console.error("Error removing team", e);
        toast({ variant: 'destructive', title: '錯誤', description: '移除隊伍失敗。'})
    }
  }

  const handleUpdateTeamPrice = async (teamId: string, price: number) => {
     if (!groupBreakRef || !groupBreak?.teams || isNaN(price) || price < 0) {
        toast({variant: 'destructive', title: '錯誤', description: '請輸入有效的價格。'});
        return;
    }
    const updatedTeams = groupBreak.teams.map(t => t.teamId === teamId ? {...t, price} : t);
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        toast({ title: '成功', description: '隊伍價格已更新。'});
    } catch(e) {
        console.error(e);
        toast({variant: 'destructive', title: '錯誤', description: '更新價格失敗。'})
    }
  }

  const handleDuplicate = async () => {
    if (!firestore || !groupBreak) {
        toast({
            variant: "destructive",
            title: "錯誤",
            description: "無法載入原始活動資料以進行複製。",
        });
        return;
    }

    const { id, ...breakToCopy } = groupBreak;
    const newBreakData: any = { ...breakToCopy };

    newBreakData.title = `(複製) ${groupBreak.title}`;
    newBreakData.status = 'draft' as const;
    newBreakData.createdAt = serverTimestamp();
    delete newBreakData.winnings;

    if (newBreakData.breakType === 'spot' && newBreakData.spots) {
        newBreakData.spots = newBreakData.spots.map((spot: Spot) => ({ spotNumber: spot.spotNumber }));
    } else if (newBreakData.breakType === 'team' && newBreakData.teams) {
        newBreakData.teams = newBreakData.teams.map((team: Team) => {
            const { userId, ...rest } = team;
            return rest;
        });
    }

    try {
        const docRef = await addDoc(collection(firestore, 'groupBreaks'), newBreakData);
        toast({
            title: "複製成功",
            description: `已建立新的團拆活動，正在前往編輯頁面...`,
        });
        router.push(`/admin/group-breaks/${docRef.id}`);
    } catch (error) {
        console.error("Error duplicating group break:", error);
        toast({
            variant: "destructive",
            title: "複製失敗",
            description: "建立副本時發生錯誤。",
        });
    }
  };


  if (isLoadingBreak || !groupBreak) {
    return <div className="container p-8"><Skeleton className="h-[500px] w-full" /></div>;
  }

  const isTeamBreak = details.breakType === 'team';
  const currency = details.currency || 'diamond';
  
  return (
    <div className="container p-6 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/admin/group-breaks')} className="-ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回清單
        </Button>
        <div className="flex items-center gap-2">
            <Badge variant={groupBreak.status === 'completed' ? 'secondary' : 'default'} className="uppercase tracking-widest font-black h-7">
                {groupBreak.status}
            </Badge>
            <Badge variant="outline" className="font-code h-7 border-white/10">ID: {groupBreak.id.substring(0, 8)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-white/5 bg-card/40">
            <CardHeader>
               <div className="flex justify-between items-center">
                 <CardTitle className="text-xl">團拆詳情設定</CardTitle>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Copy className="mr-2 h-4 w-4" /> 複製副本
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>確定要複製此團拆活動嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                                將會建立一個新的草稿活動，包含「{groupBreak.title}」的所有設定（隊伍、價格等），但會清空所有參與者與開獎紀錄。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDuplicate}>確認複製</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardDescription>編輯活動的展示資訊與直播位址。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">活動標題</Label>
                <Input id="title" value={details.title || ''} onChange={(e) => handleDetailChange('title', e.target.value)} onBlur={() => handleSaveDetails('title')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">活動簡介</Label>
                <Textarea id="description" value={details.description || ''} onChange={(e) => handleDetailChange('description', e.target.value)} onBlur={() => handleSaveDetails('description')} className="min-h-[100px]" />
              </div>

              <div className="space-y-3 p-4 bg-muted/20 border rounded-lg">
                <Label className="flex items-center gap-2 font-bold"><Gem className="h-4 w-4 text-primary"/> 支付幣別設定</Label>
                <RadioGroup 
                    value={currency} 
                    onValueChange={(val) => {
                        handleDetailChange('currency', val);
                        handleSaveDetails('currency');
                    }}
                    className="flex gap-6 pt-2"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="diamond" id="cur-dia" />
                        <Label htmlFor="cur-dia" className="cursor-pointer">鑽石 (Diamonds)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="p-point" id="cur-p" />
                        <Label htmlFor="cur-p" className="cursor-pointer text-accent flex items-center gap-1"><PPlusIcon className="h-3 w-3"/> 紅利 P 點</Label>
                    </div>
                </RadioGroup>
              </div>
              
              {!isTeamBreak && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="flex items-center gap-2">
                        {currency === 'diamond' ? <Gem className="h-3 w-3 text-primary"/> : <PPlusIcon className="h-3 w-3 text-accent"/>}
                        每位置價格
                    </Label>
                    <Input id="price" type="number" value={details.pricePerSpot || 0} onChange={(e) => handleDetailChange('pricePerSpot', Number(e.target.value))} onBlur={() => handleSaveDetails('pricePerSpot')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spots" className="flex items-center gap-2"><Package className="h-3 w-3 text-primary"/> 總名額</Label>
                    <Input id="spots" type="number" value={details.totalSpots || 0} readOnly className="bg-muted/30" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="youtubeUrl" className="flex items-center gap-2"><Youtube className="h-4 w-4 text-destructive"/> YouTube 直播 ID 或 完整連結</Label>
                <Input id="youtubeUrl" value={details.youtubeUrl || ''} onChange={(e) => handleDetailChange('youtubeUrl', e.target.value)} onBlur={() => handleSaveDetails('youtubeUrl')} placeholder="例如：dQw4w9WgXcQ" />
              </div>
               <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-lg">
                <div className="space-y-0.5">
                    <Label htmlFor="status" className="font-bold">公開上架狀態</Label>
                    <p className="text-xs text-muted-foreground">開啟後玩家即可在前台看到並購買此活動</p>
                </div>
                <Switch id="status" checked={details.status === 'published'} onCheckedChange={(checked) => {
                    const newStatus = checked ? 'published' : 'draft';
                    handleDetailChange('status', newStatus);
                    handleSaveDetails('status');
                }} disabled={groupBreak.status === 'completed'} />
              </div>
              <div className="flex items-center justify-between p-4 bg-rose-50 border rounded-lg">
                <div className="space-y-0.5">
                    <Label htmlFor="isAdult" className="font-bold text-rose-900">限制級內容 (18+)</Label>
                    <p className="text-xs text-rose-600/70">開啟後玩家購買前需進行年齡驗證</p>
                </div>
                <Switch id="isAdult" checked={!!details.isAdult} onCheckedChange={(checked) => {
                    handleDetailChange('isAdult', checked);
                    handleSaveDetails('isAdult');
                }} />
              </div>
            </CardContent>
          </Card>
          
           {isTeamBreak && (
             <Card className="shadow-lg border-white/5 bg-card/40">
                <CardHeader>
                    <CardTitle className="text-xl">隊伍與價格矩陣</CardTitle>
                    <CardDescription>手動定義每個隊伍的價格。玩家將購買特定隊伍。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-2 p-4 bg-muted/20 rounded-lg border border-dashed border-white/10">
                        <div className="flex-1 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">新隊伍名稱</Label>
                            <Input placeholder="例如：洛杉磯道奇" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                        </div>
                        <div className="w-32 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">價格 ({currency === 'diamond' ? '鑽石' : 'P點'})</Label>
                            <Input type="number" placeholder="0" value={newTeamPrice || ''} onChange={(e) => setNewTeamPrice(Number(e.target.value))} />
                        </div>
                        <Button onClick={handleAddTeam} className="mt-5 font-bold"><PlusCircle className="mr-2 h-4 w-4"/>新增</Button>
                    </div>
                     <div className="border rounded-xl bg-card/50 max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="pl-6">隊伍名稱</TableHead>
                                    <TableHead className="w-40">價格</TableHead>
                                    <TableHead className="w-20 text-right pr-6">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {details.teams?.map(team => (
                                    <TableRow key={team.teamId} className="hover:bg-white/5 transition-colors">
                                        <TableCell className="font-bold pl-6">{team.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {currency === 'diamond' ? <Gem className="h-3 w-3 text-primary opacity-50"/> : <PPlusIcon className="h-3 w-3 opacity-50"/>}
                                                <Input 
                                                    type="number" 
                                                    defaultValue={team.price}
                                                    onBlur={(e) => handleUpdateTeamPrice(team.teamId, Number(e.target.value))}
                                                    className="h-8 bg-transparent"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                             <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveTeam(team.teamId)}>
                                                <Trash2 className="w-4 h-4"/>
                                             </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!details.teams || details.teams.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground italic">尚未新增任何隊伍選項</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                     </div>
                </CardContent>
             </Card>
           )}
           <PrizeAssignment groupBreak={groupBreak} groupBreakRef={groupBreakRef} />
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-white/5 bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg">視覺封面</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video rounded-xl bg-muted/30 border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center group">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Preview" fill className="object-cover transition-transform group-hover:scale-105 duration-500" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                )}
              </div>
              <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} className="bg-background/50" />
              {uploadProgress !== null ? (
                <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-1.5" />
                    <p className="text-[10px] text-center font-bold text-primary">上傳中 {Math.round(uploadProgress)}%</p>
                </div>
              ) : (
                <Button onClick={handleImageUpload} disabled={!selectedFile} className="w-full font-bold">
                  <Upload className="mr-2 h-4 w-4" /> 更換活動圖片
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-lg text-destructive">危險區域</CardTitle>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full font-bold">重設參與者數據</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>確定要清空所有購買紀錄嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                                這將會移除所有已購買的位置/隊伍資料，且不會自動退款點數給玩家。請僅在測試或誤設時使用。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetParticipants} className="bg-destructive hover:bg-destructive/90">確認重設</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
