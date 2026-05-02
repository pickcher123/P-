'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Gem, User as UserIcon, Sparkles } from 'lucide-react';
import type { UserProfile } from '@/types/user-profile';
import { Badge } from '@/components/ui/badge';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    transactionType: 'Purchase' | 'Deposit' | 'Withdrawal' | 'QuickSell' | 'Refund';
    section?: string;
    currency?: 'diamond' | 'p-point';
    details?: string;
    status: 'pending' | 'completed' | 'failed';
}

export default function DepositsAdminPage() {
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'all' | 'deposit' | 'admin'>('all');

  const depositsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'transactions'), 
      where('transactionType', '==', 'Deposit'), 
      where('section', 'in', ['deposit', 'admin'])
    );
  }, [firestore]);

  const { data: deposits, isLoading: isLoadingDeposits } = useCollection<Transaction>(depositsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
      const map: Record<string, string> = {};
      users?.forEach(u => map[u.id] = u.username);
      return map;
  }, [users]);

  const sortedDeposits = useMemo(() => {
    if (!deposits) return [];
    // Only show completed transactions
    let filtered = deposits.filter(tx => tx.status === 'completed');
    
    if (filter === 'deposit') {
      filtered = filtered.filter(tx => tx.section === 'deposit');
    } else if (filter === 'admin') {
      filtered = filtered.filter(tx => tx.section === 'admin');
    }
    return filtered.sort((a, b) => b.transactionDate.seconds - a.transactionDate.seconds);
  }, [deposits, filter]);

  const isLoading = isLoadingDeposits || isLoadingUsers;

  return (
    <div className="container mx-auto p-6 md:p-8 text-slate-900">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-black tracking-tight">儲值管理</h1>
        <p className="mt-2 text-slate-600 font-bold">查看所有使用者的線上儲值與點數包購入紀錄。</p>
      </div>

      <div className="mb-6">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
            <TabsList className="bg-slate-100 p-1 h-11">
                <TabsTrigger value="all" className="font-bold px-8">全部紀錄</TabsTrigger>
                <TabsTrigger value="deposit" className="font-bold px-8">線上儲值</TabsTrigger>
                <TabsTrigger value="admin" className="font-bold px-8">管理員配點</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="min-w-[800px] md:min-w-full">
            <TableHeader className="bg-slate-50">
            <TableRow className="border-b-slate-200">
              <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest py-5 pl-8">會員資訊</TableHead>
              <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest text-center">儲值金額</TableHead>
              <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">交易ID</TableHead>
              <TableHead className="text-right pr-8 text-slate-900 font-black uppercase text-[10px] tracking-widest">儲值時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                </TableRow>
              ))}
            {!isLoading && sortedDeposits.map((tx) => (
              <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100">
                <TableCell className="pl-8 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{userMap[tx.userId] || '未知會員'}</p>
                                {tx.section === 'admin' && (
                                    <Badge variant="outline" className="text-[9px] font-black bg-amber-50 text-amber-700 border-amber-200 px-1.5 h-4 uppercase">
                                        <Sparkles className="w-2 h-2 mr-1" /> 管理員配點
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[10px] font-mono font-bold text-slate-400 truncate">{tx.userId}</p>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <div className={cn(
                        "flex items-center justify-center gap-1.5 font-black font-code text-base",
                        tx.currency === 'p-point' ? "text-amber-600" : "text-emerald-600"
                    )}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} 
                        {tx.currency === 'p-point' ? <PPlusIcon className="h-4 w-4" /> : <Gem className="h-4 w-4" />}
                    </div>
                </TableCell>
                <TableCell className="font-mono text-[10px] font-bold text-slate-400">{tx.id}</TableCell>
                <TableCell className="text-right pr-8 font-code text-xs text-slate-500 font-bold">{tx.transactionDate ? format(new Date(tx.transactionDate.seconds * 1000), 'yyyy-MM-dd HH:mm') : 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {!isLoading && sortedDeposits.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold italic">目前尚無儲值紀錄。</div>
        )}
      </div>
    </div>
  );
}
