
'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type BreakType = 'spot' | 'team';

interface GroupBreak {
  id: string;
  title: string;
  pricePerSpot?: number;
  totalSpots?: number;
  teams?: { userId?: string }[];
  spots?: { userId?: string }[];
  breakType: BreakType;
  status: 'draft' | 'published' | 'completed';
  createdAt: { seconds: number };
}

const defaultBreak: Omit<GroupBreak, 'id' | 'createdAt'> = {
  title: '',
  pricePerSpot: 100,
  totalSpots: 30,
  status: 'draft',
  breakType: 'spot',
};

export default function GroupBreaksAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBreak, setNewBreak] = useState(defaultBreak);

  const groupBreaksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'groupBreaks'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: groupBreaks, isLoading } = useCollection<GroupBreak>(groupBreaksQuery);

  const handleAddNew = () => {
    setNewBreak(defaultBreak);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !newBreak.title) {
      toast({ variant: 'destructive', title: '錯誤', description: '標題為必填項。' });
      return;
    }

    try {
      const dataToSave: any = {
        title: newBreak.title,
        isAdult: !!newBreak.isAdult,
        status: newBreak.status,
        breakType: newBreak.breakType,
        createdAt: new Date(),
        imageUrl: `https://picsum.photos/seed/${Math.random()}/1280/720`,
      };
      
      if (newBreak.breakType === 'spot') {
        dataToSave.pricePerSpot = newBreak.pricePerSpot;
        dataToSave.totalSpots = newBreak.totalSpots;
        dataToSave.spots = Array.from({ length: newBreak.totalSpots || 0 }, (_, i) => ({ spotNumber: i + 1 }));
      } else {
        dataToSave.teams = [];
      }

      const docRef = await addDoc(collection(firestore, 'groupBreaks'), dataToSave);
      toast({ title: '成功', description: '新團拆活動已建立。' });
      setIsDialogOpen(false);
      router.push(`/admin/group-breaks/${docRef.id}`);
    } catch (error) {
      console.error('Error creating group break:', error);
      toast({ variant: 'destructive', title: '錯誤', description: '建立活動失敗。' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'groupBreaks', id));
        toast({ title: '成功', description: '團拆活動已刪除。'});
    } catch (e) {
        console.error('Error deleting group break:', e);
        toast({ variant: 'destructive', title: '刪除失敗' });
    }
  }

  const handleStatusToggle = async (id: string, currentStatus: 'draft' | 'published' | 'completed') => {
    if (!firestore) return;
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
        await updateDoc(doc(firestore, 'groupBreaks', id), { status: newStatus });
        toast({ title: '成功', description: `狀態已更新為 ${newStatus}`});
    } catch (e) {
        console.error('Error updating status:', e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新狀態失敗。'});
    }
  };

  return (
    <div className="container mx-auto p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">團拆管理</h1>
          <p className="mt-2 text-muted-foreground">建立並管理團拆活動。</p>
        </div>
        <Button onClick={handleAddNew}><PlusCircle className="mr-2" /> 新增團拆</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增團拆活動</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">標題</Label>
              <Input id="title" value={newBreak.title} onChange={e => setNewBreak({ ...newBreak, title: e.target.value })} />
            </div>
             <div className="space-y-2">
                <Label>團拆模式</Label>
                <RadioGroup defaultValue="spot" value={newBreak.breakType} onValueChange={(value: BreakType) => setNewBreak({...newBreak, breakType: value})}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="spot" id="r1" />
                        <Label htmlFor="r1">號碼模式</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="team" id="r2" />
                        <Label htmlFor="r2">隊伍模式</Label>
                    </div>
                </RadioGroup>
             </div>
             <div className="flex items-center space-x-2 pt-2">
                <Switch
                    id="isAdult"
                    checked={newBreak.isAdult || false}
                    onCheckedChange={(checked) => setNewBreak({...newBreak, isAdult: checked})}
                />
                <Label htmlFor="isAdult">限制級內容 (18+)</Label>
            </div>
            {newBreak.breakType === 'spot' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">每位置價格</Label>
                    <Input id="price" type="number" value={newBreak.pricePerSpot} onChange={e => setNewBreak({ ...newBreak, pricePerSpot: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spots">總位置</Label>
                    <Input id="spots" type="number" value={newBreak.totalSpots} onChange={e => setNewBreak({ ...newBreak, totalSpots: Number(e.target.value) })} />
                  </div>
                </div>
            )}
             {newBreak.breakType === 'team' && (
                <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md">
                    隊伍選項和價格將在活動詳情頁中設定。
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave}>建立活動</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>模式</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>價格</TableHead>
              <TableHead>建立時間</TableHead>
              <TableHead>上架</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
            {groupBreaks?.map((b) => {
              const participantCount = b.breakType === 'team'
                ? (b.teams?.filter(t => t.userId).length || 0)
                : (b.spots?.filter(s => s.userId).length || 0);

              const totalSpots = b.breakType === 'team'
                ? (b.teams?.length || 0)
                : (b.totalSpots || 0);

              const isFull = totalSpots > 0 && participantCount >= totalSpots;
              const statusText = b.status === 'completed' ? '已完成' : isFull ? '已滿團' : '進行中';

              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell><Badge variant="outline">{b.breakType === 'team' ? '隊伍' : '號碼'}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'completed' ? 'secondary' : isFull ? 'destructive' : 'default'}>
                      {statusText}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.breakType === 'spot' ? `$${b.pricePerSpot}` : '按隊伍'}</TableCell>
                  <TableCell>{b.createdAt ? format(b.createdAt.seconds * 1000, 'yyyy-MM-dd') : 'N/A'}</TableCell>
                  <TableCell>
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`status-switch-${b.id}`}
                                checked={b.status === 'published'}
                                onCheckedChange={() => handleStatusToggle(b.id, b.status)}
                                disabled={b.status === 'completed'}
                            />
                            <Label htmlFor={`status-switch-${b.id}`} className={cn(b.status === 'published' ? 'text-green-500' : 'text-muted-foreground')}>
                                {b.status === 'published' ? '已上架' : '草稿'}
                            </Label>
                        </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/group-breaks/${b.id}`)}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>確定刪除?</AlertDialogTitle>
                          <AlertDialogDescription>此操作將永久刪除「{b.title}」，無法復原。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(b.id)}>確認刪除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {!isLoading && groupBreaks?.length === 0 && (
          <div className="text-center p-8 text-muted-foreground">
            沒有團拆活動
          </div>
        )}
      </Card>
    </div>
  );
}

    