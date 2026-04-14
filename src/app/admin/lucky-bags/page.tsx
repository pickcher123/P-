
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, writeBatch, orderBy, getCountFromServer } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Gem, Users, Trash2, Edit, Trophy, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

type LuckBagStatus = 'draft' | 'published';

interface LuckBag {
  id?: string;
  name: string;
  price: number;
  totalParticipants: number;
  revealLottery?: boolean;
  imageUrl?: string;
  status?: LuckBagStatus;
  order?: number;
  prizes?: {
    first?: string;
    second?: string;
    third?: string;
  };
}

interface LuckBagWithData extends LuckBag {
    participantCount: number;
}

const defaultLuckBag: Omit<LuckBag, 'id'> = {
    name: '',
    price: 100,
    totalParticipants: 100,
    revealLottery: false,
    status: 'draft',
    order: 0,
};

export default function LuckyBagsAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBag, setNewBag] = useState(defaultLuckBag);
  const [luckyBagsWithData, setLuckyBagsWithData] = useState<LuckBagWithData[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);

  const luckBagsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'luckBags'));
  }, [firestore]);

  const { data: luckyBags, isLoading: isLoadingBags } = useCollection<LuckBag>(luckBagsCollection);

  useEffect(() => {
    const fetchExtraData = async () => {
        if (!luckyBags || !firestore) return;

        setIsListLoading(true);
        const sortedLuckyBags = [...luckyBags].sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

        const bagsWithData = await Promise.all(
            sortedLuckyBags.map(async (bag) => {
                if (!bag.id) return { ...bag, participantCount: 0 };
                const purchasesColRef = collection(firestore, 'luckBags', bag.id, 'luckBagPurchases');
                const countSnapshot = await getCountFromServer(query(purchasesColRef));
                const participantCount = countSnapshot.data().count;

                return {
                    ...bag,
                    participantCount,
                };
            })
        );
        setLuckyBagsWithData(bagsWithData);
        setIsListLoading(false);
    };

    if (!isLoadingBags) {
        fetchExtraData();
    }
  }, [luckyBags, firestore, isLoadingBags]);


  const handleAddNew = () => {
    setNewBag({...defaultLuckBag, order: (luckyBags?.length ?? 0) + 1});
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !newBag.name || !newBag.totalParticipants || !newBag.price) {
        toast({ variant: "destructive", title: "錯誤", description: "所有欄位皆為必填項。" });
        return;
    }

    try {
      const dataToSave = {
        ...newBag,
        prizes: {
            first: '',
            second: '',
            third: '',
        },
        imageUrl: '',
        imageHint: 'custom upload',
      };

      const docRef = await addDoc(collection(firestore, 'luckBags'), dataToSave);
      toast({ title: "成功", description: "新福袋已新增。請點擊進入詳情頁以設定獎品。" });
      
      setIsDialogOpen(false);
      router.push(`/admin/lucky-bags/${docRef.id}`);

    } catch (error) {
      console.error("Error creating luck bag: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "建立福袋時發生錯誤。" });
    }
  };

  const handleDeleteBag = async (bagId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'luckBags', bagId));
      toast({ title: "成功", description: "福袋已刪除。" });
    } catch (error) {
        console.error("Error deleting luck bag: ", error);
        toast({ variant: "destructive", title: "錯誤", description: "刪除福袋時發生錯誤。" });
    }
  }
  
  const handleStatusToggle = async (bagId: string, currentStatus: string = 'draft') => {
      if(!firestore) return;
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      try {
          await updateDoc(doc(firestore, 'luckBags', bagId), { status: newStatus });
          toast({ title: "狀態已更新", description: `福袋已更新為 ${newStatus === 'published' ? '已發佈' : '草稿'}`});
      } catch (error) {
          console.error("Error updating status:", error);
          toast({ variant: "destructive", title: "錯誤", description: "更新狀態時發生錯誤" });
      }
  }

  const handleOrderChange = useCallback(async (bagId: string, newOrder: number) => {
    if (!firestore || !bagId) return;
    if (isNaN(newOrder)) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的數字。' });
        return;
    }
    try {
        const bagRef = doc(firestore, 'luckBags', bagId);
        await updateDoc(bagRef, { order: newOrder });
        toast({ title: '成功', description: '順序已更新。' });
    } catch (error) {
        console.error("Error updating bag order:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
    }
  }, [firestore, toast]);

  const finalIsLoading = isLoadingBags || isListLoading;

  return (
    <div className="container mx-auto p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">福袋管理</h1>
            <p className="mt-2 text-muted-foreground">建立並管理集滿即開的福袋活動。獎項預覽將在詳情頁中顯示。</p>
        </div>
        <Button onClick={handleAddNew}><PlusCircle className="mr-2" /> 新增福袋</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增福袋</DialogTitle>
            <DialogDescription>
              填寫新福袋的基本資訊。獎品細節可在詳情頁中設定。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">福袋名稱</Label>
              <Input id="name" value={newBag.name} onChange={e => setNewBag({...newBag, name: e.target.value})} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="price">價格 (每格)</Label>
                    <Input id="price" type="number" value={newBag.price} onChange={e => setNewBag({...newBag, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="totalParticipants">總參與人數</Label>
                    <Input id="totalParticipants" type="number" value={newBag.totalParticipants} onChange={e => setNewBag({...newBag, totalParticipants: Number(e.target.value)})} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="order">排序權重</Label>
                <Input id="order" type="number" value={newBag.order} onChange={e => setNewBag({...newBag, order: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>儲存並前往設定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-6">福袋名稱</TableHead>
              <TableHead>價格</TableHead>
              <TableHead>參與狀態</TableHead>
              <TableHead>活動進度</TableHead>
              <TableHead>上架狀態</TableHead>
              <TableHead className="w-24">排序</TableHead>
              <TableHead className="text-right pr-6">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finalIsLoading && Array.from({length: 5}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
            ))}
            {luckyBagsWithData.map((bag) => (
                <TableRow key={bag.id} className="hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6">
                        <button 
                            onClick={() => router.push(`/admin/lucky-bags/${bag.id}`)}
                            className="font-bold text-lg hover:text-primary transition-colors text-left"
                        >
                            {bag.name}
                        </button>
                    </TableCell>
                    <TableCell className="font-code font-bold text-accent">
                        <div className="flex items-center gap-1">
                            {(bag.price || 0).toLocaleString()}
                            {bag.currency === 'diamond' ? <Gem className="w-4 h-4 text-primary" /> : <PPlusIcon className="w-4 h-4" />}
                        </div>
                    </TableCell>
                    <TableCell className="font-code text-sm">
                        <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 opacity-50" />
                            {bag.participantCount} / {bag.totalParticipants}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant={bag.revealLottery ? 'default' : bag.participantCount >= (bag.totalParticipants ?? 0) ? 'secondary' : 'outline'} className="text-[10px]">
                             {bag.revealLottery ? '開獎中' : (bag.participantCount >= (bag.totalParticipants ?? 0) ? '已滿團' : '進行中')}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`status-switch-${bag.id}`}
                                checked={bag.status === 'published'}
                                onCheckedChange={() => handleStatusToggle(bag.id!, bag.status)}
                            />
                            <Label htmlFor={`status-switch-${bag.id}`} className={cn("text-[10px]", bag.status === 'published' ? 'text-green-500' : 'text-muted-foreground')}>
                                {bag.status === 'published' ? '已上架' : '草稿'}
                            </Label>
                        </div>
                    </TableCell>
                    <TableCell>
                         <Input
                            type="number"
                            defaultValue={bag.order}
                            className="h-8 w-16 text-center font-code bg-background/50"
                            onBlur={(e) => handleOrderChange(bag.id!, parseInt(e.target.value))}
                        />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/lucky-bags/${bag.id}`)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>確定要刪除「{bag.name}」嗎？</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            此操作將永久刪除此福袋活動及其所有關聯數據。此動作無法復原。
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteBag(bag.id!)} className="bg-destructive hover:bg-destructive/90">確認刪除</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </TableCell>
                </TableRow>
            ))}
             {!finalIsLoading && luckyBagsWithData.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground italic">
                        目前尚未建立任何福袋活動。
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
