'use client';

import { useState, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, Timestamp, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Ticket, Package, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge';

interface CardPool {
  id?: string;
  name: string;
  description: string;
  price?: number;
  price3Draws?: number;
  totalPacks?: number;
  remainingPacks?: number;
  categoryId?: string;
  order?: number;
  status?: 'draft' | 'published';
}

export default function CardPoolsAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const categoryId = params.categoryId as string;

  const cardPoolsCollection = useMemoFirebase(() => {
    if (!firestore || !categoryId) return null;
    return query(collection(firestore, 'cardPools'), where('categoryId', '==', decodeURIComponent(categoryId)));
  }, [firestore, categoryId]);

  const { data: cardPools, isLoading: isLoadingPools } = useCollection<CardPool>(cardPoolsCollection);

  const handleAddNew = async () => {
    if (!firestore || !categoryId) {
        toast({ variant: "destructive", title: "錯誤", description: "缺少分類資訊。" });
        return;
    }
    try {
      const dataToSave = {
        name: '新卡池',
        description: '請填寫描述',
        price: 150,
        price3Draws: 400,
        totalPacks: 0,
        remainingPacks: 0,
        categoryId: decodeURIComponent(categoryId),
        order: (cardPools?.length ?? 0) + 1,
        cards: [],
        pointPrizes: [],
        cardRarities: {},
        expiresAt: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 30))),
        imageUrl: `https://picsum.photos/seed/${Math.random()}/800/600`,
        status: 'draft',
      };

      const docRef = await addDoc(collection(firestore, 'cardPools'), dataToSave);
      toast({ title: "成功", description: "新卡池已新增。" });
      router.push(`/admin/card-pools/p/${docRef.id}`);

    } catch (error) {
      console.error("Error creating card pool: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "建立卡池時發生錯誤。" });
    }
  };
  
  const handleDelete = async (poolId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'cardPools', poolId));
      toast({ title: "成功", description: "卡池已刪除。" });
    } catch (error) {
      console.error("Error deleting card pool: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "刪除卡池時發生錯誤。" });
    }
  };

  const handleStatusToggle = async (poolId: string, currentStatus: string = 'draft') => {
      if(!firestore) return;
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      try {
          await updateDoc(doc(firestore, 'cardPools', poolId), { status: newStatus });
          toast({ title: "狀態已更新", description: `卡池已更新為 ${newStatus === 'published' ? '已上架' : '草稿'}`});
      } catch (error) {
          console.error("Error updating status:", error);
          toast({ variant: "destructive", title: "錯誤", description: "更新狀態時發生錯誤" });
      }
  }

  const handleOrderChange = useCallback(async (poolId: string, newOrder: number) => {
    if (!firestore) return;
     if (isNaN(newOrder)) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的數字。' });
        return;
    }
    try {
        await updateDoc(doc(firestore, 'cardPools', poolId), { order: newOrder });
        toast({ title: '成功', description: '順序已更新。' });
    } catch (error) {
        console.error('Error updating pool order:', error);
        toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
    }
  }, [firestore, toast]);
  
  const isLoading = isLoadingPools;

  return (
    <div className="container mx-auto p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <Button variant="ghost" onClick={() => router.push('/admin/card-pools')} className="mb-2 -ml-4">
                <ArrowLeft className="mr-2" />
                返回分類列表
            </Button>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">卡池管理: {decodeURIComponent(categoryId)}</h1>
            <p className="mt-2 text-muted-foreground">管理此分類下的所有卡池數據。預覽圖片已移除以優化載入速度。</p>
        </div>
        <Button onClick={handleAddNew}><PlusCircle className="mr-2" /> 新增卡池</Button>
      </div>

      <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-6">卡池名稱</TableHead>
              <TableHead>價格 (單抽/三抽)</TableHead>
              <TableHead>存量狀態</TableHead>
              <TableHead>上架狀態</TableHead>
              <TableHead className="w-24">排序權重</TableHead>
              <TableHead className="text-right pr-6 w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({length: 5}).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
            {cardPools?.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map((pool) => (
              <TableRow key={pool.id} className="hover:bg-white/5 transition-colors group">
                <TableCell className="pl-6">
                    <button 
                        onClick={() => router.push(`/admin/card-pools/p/${pool.id}`)}
                        className="font-bold text-lg hover:text-primary transition-colors text-left"
                    >
                        {pool.name}
                    </button>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">{pool.description}</p>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm font-bold">
                            <Ticket className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            {pool.price}
                        </div>
                        {pool.price3Draws && (
                            <div className="text-[10px] text-muted-foreground flex items-center">
                                <Package className="mr-1 h-2.5 w-2.5" />
                                3抽: {pool.price3Draws}
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant={pool.remainingPacks === 0 ? "destructive" : "secondary"} className={cn("font-code text-xs px-2", pool.remainingPacks! > 0 && "bg-green-500/10 text-green-500 border-green-500/20")}>
                        {pool.remainingPacks} / {pool.totalPacks} PACKS
                    </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                        <Switch 
                            id={`status-switch-${pool.id}`}
                            checked={pool.status === 'published'}
                            onCheckedChange={() => handleStatusToggle(pool.id!, pool.status)}
                        />
                        <Label htmlFor={`status-switch-${pool.id}`} className={cn("text-[10px]", pool.status === 'published' ? 'text-green-500' : 'text-muted-foreground')}>
                            {pool.status === 'published' ? '已上架' : '草稿'}
                        </Label>
                    </div>
                </TableCell>
                <TableCell>
                    <Input
                        id={`order-${pool.id}`}
                        type="number"
                        defaultValue={pool.order}
                        className="h-8 w-16 text-center font-code bg-background/50"
                        onBlur={(e) => handleOrderChange(pool.id!, parseInt(e.target.value))}
                    />
                </TableCell>
                <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={() => router.push(`/admin/card-pools/p/${pool.id}`)}>
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
                                <AlertDialogTitle>確定要刪除「{pool.name}」嗎？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作將永久刪除整個卡池及其所有設定，此動作無法復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(pool.id!)} className="bg-destructive hover:bg-destructive/90">確認刪除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
         {!isLoading && cardPools?.length === 0 && (
            <div className="text-center p-20 text-muted-foreground border border-dashed border-white/5 m-6 rounded-lg bg-white/5">
                目前此分類下沒有卡池。
            </div>
        )}
      </div>
    </div>
  );
}
