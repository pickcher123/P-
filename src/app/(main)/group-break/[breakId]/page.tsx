'use client';

import { useState, useMemo, useEffect } from 'react';
import { SafeImage } from '@/components/safe-image';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection, serverTimestamp, increment, runTransaction, writeBatch } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Gem, Loader2, Dices, 
  CheckCircle2, 
  Radio, Zap, SearchCode, X, Hash,
  TicketCheck, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UserProfile } from '@/types/user-profile';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo, PPlusIcon } from '@/components/icons';
import { CardItem } from '@/components/card-item';
import { VerifyAgeModal } from '@/components/verify-age-modal';


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

interface GroupBreak {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pricePerSpot?: number;
  totalSpots?: number;
  youtubeUrl?: string;
  spots?: Spot[];
  teams?: Team[];
  breakType: 'spot' | 'team';
  currency?: 'diamond' | 'p-point';
  status: 'draft' | 'published' | 'completed';
  winnings?: Winnings[];
}

interface Winnings {
    userId: string;
    username: string;
    teamId: string;
    teamName: string;
    cardId?: string;
    cardName?: string;
    cardImageUrl?: string;
    cardBackImageUrl?: string;
}

export default function GroupBreakDetailPage() {
  const { breakId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const [selectedSpots, setSelectedSpots] = useState<Set<number>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
  const [randomPickCount, setRandomPickCount] = useState(1);
  const [previewCard, setPreviewCard] = useState<Winnings | null>(null);


  const groupBreakRef = useMemoFirebase(() => {
    if (!firestore || !breakId) return null;
    return doc(firestore, 'groupBreaks', breakId as string);
  }, [firestore, breakId]);

  const { data: groupBreak, isLoading: isLoadingBreak, forceRefetch } = useDoc<GroupBreak>(groupBreakRef);

  const { takenSpots, takenTeams, isFull } = useMemo(() => {
    if (!groupBreak) return { takenSpots: new Set(), takenTeams: new Set(), isFull: false };
    
    let currentParticipantCount = 0;
    let totalPossibleSpots = 0;

    const spots = new Set<number>();
    if (groupBreak.breakType === 'spot') {
      groupBreak.spots?.forEach(spot => { if (spot.userId) spots.add(spot.spotNumber); });
      currentParticipantCount = spots.size;
      totalPossibleSpots = groupBreak.totalSpots || 0;
    }

    const teams = new Set<string>();
    if (groupBreak.breakType === 'team') {
        groupBreak.teams?.forEach(team => { if(team.userId) teams.add(team.teamId); });
        currentParticipantCount = teams.size;
        totalPossibleSpots = groupBreak.teams?.length || 0;
    }
    
    return { takenSpots: spots, takenTeams: teams, isFull: totalPossibleSpots > 0 && currentParticipantCount >= totalPossibleSpots };
  }, [groupBreak]);
  
  const handleSpotClick = (spotNumber: number) => {
    if (takenSpots.has(spotNumber)) return;
    setSelectedSpots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spotNumber)) newSet.delete(spotNumber);
      else newSet.add(spotNumber);
      return newSet;
    });
  };
  
  const handleTeamClick = (teamId: string) => {
    if(takenTeams.has(teamId)) return;
    setSelectedTeams(prev => {
        const newSet = new Set(prev);
        if(newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        return newSet;
    })
  }

  const handleConfirmRandomPick = () => {
    if (!groupBreak) return;
    const isTeamBreak = groupBreak.breakType === 'team';
    
    const available = isTeamBreak 
        ? (groupBreak.teams || []).filter(t => !t.userId && !selectedTeams.has(t.teamId))
        : Array.from({ length: groupBreak.totalSpots || 0 }).map((_, i) => i + 1).filter(s => !takenSpots.has(s) && !selectedSpots.has(s));

    if (available.length < randomPickCount) {
        toast({ variant: "destructive", title: "名額不足", description: `剩餘可選名額不足 ${randomPickCount} 個。`});
        return;
    }

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, randomPickCount);

    if (isTeamBreak) {
        setSelectedTeams(prev => {
            const newSet = new Set(prev);
            picked.forEach((t: any) => newSet.add(t.teamId));
            return newSet;
        });
    } else {
        setSelectedSpots(prev => {
            const newSet = new Set(prev);
            picked.forEach((s: any) => newSet.add(s));
            return newSet;
        });
    }
    setIsRandomPickOpen(false);
  };

  const handlePurchase = async () => {
    if (groupBreak?.isAdult && !isVerified) {
        setIsAgeModalOpen(true);
        return;
    }
    if (!user || !firestore || !groupBreakRef || !groupBreak) return;
    const isTeamBreak = groupBreak.breakType === 'team';
    const hasSelection = isTeamBreak ? selectedTeams.size > 0 : selectedSpots.size > 0;
    if (!hasSelection) return;

    const currency = groupBreak.currency || 'diamond';

    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const groupBreakSnap = await transaction.get(groupBreakRef);
            if (!groupBreakSnap.exists()) throw new Error("此團拆活動不存在。");
            const currentGroupBreak = groupBreakSnap.data() as GroupBreak;
            
            let totalCost = isTeamBreak 
                ? Array.from(selectedTeams).reduce((acc, teamId) => acc + (currentGroupBreak.teams?.find(t => t.teamId === teamId)?.price || 0), 0)
                : selectedSpots.size * (currentGroupBreak.pricePerSpot || 0);
            
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("找不到使用者資料。");
            
            const userData = userSnap.data() as UserProfile;
            const walletBalance = currency === 'diamond' ? (userData.points || 0) : (userData.bonusPoints || 0);

            if (walletBalance < totalCost) {
                throw new Error(`您的${currency === 'diamond' ? '鑽石' : 'P點'}餘額不足，需要 ${totalCost} 點。`);
            }
            
            if(isTeamBreak) {
                for (const teamId of selectedTeams) {
                    const team = currentGroupBreak.teams?.find(t => t.teamId === teamId);
                    if (team?.userId) throw new Error("部分隊伍已被選走，請重新整理後再試。");
                }
                const updatedTeams = currentGroupBreak.teams?.map(t => selectedTeams.has(t.teamId) ? { ...t, userId: user.uid } : t);
                transaction.update(groupBreakRef, { teams: updatedTeams });
            } else {
                for (const spotNumber of selectedSpots) {
                    const spot = currentGroupBreak.spots?.find(s => s.spotNumber === spotNumber);
                    if (spot?.userId) throw new Error("部分號碼已被選走，請重新整理後再試。");
                }
                 const updatedSpots = currentGroupBreak.spots?.map(s => selectedSpots.has(s.spotNumber) ? { ...s, userId: user.uid } : s);
                 transaction.update(groupBreakRef, { spots: updatedSpots });
            }
            
            const walletField = currency === 'diamond' ? 'points' : 'bonusPoints';
            const updates: any = { [walletField]: increment(-totalCost) };

            if (currency === 'diamond') {
                updates.totalSpent = increment(totalCost);
            }

            transaction.update(userRef, updates);
            transaction.set(doc(collection(firestore, 'transactions')), { 
                userId: user.uid, 
                transactionType: 'Purchase', 
                section: 'group-break', 
                currency: currency,
                amount: -totalCost, 
                details: `購買 ${currentGroupBreak.title} 的位置/隊伍 (${currency})`, 
                transactionDate: serverTimestamp() 
            });
        });

        toast({ title: '購買成功！', description: `祝您在團拆中獲得大獎！` });
        setSelectedTeams(new Set());
        setSelectedSpots(new Set());
        if (forceRefetch) forceRefetch();
    } catch (error: any) {
        toast({ variant: 'destructive', title: '購買失敗', description: error.message });
    } finally { setIsSubmitting(false); }
  };

  if (isLoadingBreak) return <div className="container py-32 text-center text-slate-900"><Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" /><p className="mt-4 font-headline tracking-widest animate-pulse">正在搜尋電視頻道...</p></div>;
  if (!groupBreak) return <div className="container py-20 text-center font-bold">頻道收訊中斷：找不到此活動。</div>;

  const isTeamBreak = groupBreak.breakType === 'team';
  const totalCost = isTeamBreak 
    ? (groupBreak.teams || []).reduce((acc, team) => selectedTeams.has(team.teamId) ? acc + team.price : acc, 0)
    : selectedSpots.size * (groupBreak.pricePerSpot || 0);
  const selectionCount = isTeamBreak ? selectedTeams.size : selectedSpots.size;
  const currency = groupBreak.currency || 'diamond';

  return (
    <div className="container py-8 md:py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary/5 blur-[100px] pointer-events-none" />
      
      <Button variant="ghost" onClick={() => router.back()} className="mb-8 hover:bg-white/5 font-bold animate-fade-in-up">
        <ArrowLeft className="mr-2 h-4 w-4" /> 返回頻道列表
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2 space-y-4 px-2">
          <div className="relative flex flex-col p-4 bg-slate-800 border-b-[12px] border-r-[12px] border-slate-950 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
            <div className="relative flex-1 bg-slate-900 rounded-[2rem] p-4 md:p-6 shadow-inner border-b-4 border-white/5">
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-4 border-slate-950 shadow-[inset:0_0_30px_rgba(0,0,0,1)]">
                    <SafeImage src={groupBreak.imageUrl} alt={groupBreak.title} fill className="object-cover opacity-80" />
                    <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,2px_100%]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                    
                    {(isFull || groupBreak.status === 'completed') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                            <Badge className="bg-destructive text-white text-xl font-black px-8 py-2 rounded-full rotate-[-12deg] shadow-2xl border-4 border-white/20">
                                {groupBreak.status === 'completed' ? '離線狀態' : '已全數售罄'}
                            </Badge>
                        </div>
                    )}
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_red]", groupBreak.status === 'completed' ? "bg-red-900" : "bg-red-600 animate-pulse")} />
                            <span className="text-[6px] font-black text-white/40 uppercase">電源</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_rgba(6,182,212,1)]", groupBreak.status === 'completed' ? "bg-cyan-900" : "bg-primary animate-pulse")} />
                            <span className="text-[6px] font-black text-white/40 uppercase">訊號</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-4 px-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-[0.3em] uppercase">
                <Radio className="w-3.5 h-3.5" /> 直播訊號傳輸中
            </div>
            <h1 className="font-headline text-3xl md:text-4xl font-black text-white leading-tight tracking-tighter italic drop-shadow-md">{groupBreak.title}</h1>
            <p className="text-muted-foreground leading-relaxed font-medium opacity-80">{groupBreak.description}</p>
            {groupBreak.youtubeUrl && (
                <div className="mt-6">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-2">
                        {groupBreak.status === 'completed' ? '直播檔案回顧' : '實況傳輸頻道'}
                    </p>
                    <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 font-black shadow-lg text-lg">
                        <Link href={groupBreak.youtubeUrl.includes('youtube.com') ? groupBreak.youtubeUrl : `https://youtube.com/watch?v=${groupBreak.youtubeUrl}`} target="_blank">
                            {groupBreak.status === 'completed' ? '▶ 點擊觀看回顧' : '前往收看實況頻道'}
                        </Link>
                    </Button>
                </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 animate-fade-in-up">
          <div className="sticky top-24 bg-slate-200 p-6 md:p-10 rounded-[2.5rem] border-b-[12px] border-r-[12px] border-slate-400 shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 text-slate-900">
                  <div>
                    <h2 className="font-headline text-xl font-black flex items-center gap-3 text-slate-900 tracking-tighter uppercase italic">
                        <TicketCheck className="h-6 w-6"/> {isTeamBreak ? '選擇隊伍' : '選擇位置'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">控制器連接埠已啟動</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => setIsRandomPickOpen(true)} disabled={isFull || groupBreak.status === 'completed'} className="h-10 rounded-xl bg-slate-300 border-none text-slate-700 font-black shadow-inner">
                        <Dices className="mr-2 h-4 w-4 text-slate-600"/> 自動選號
                      </Button>
                  </div>
              </div>

              <ScrollArea className="h-[400px] rounded-3xl border-4 border-slate-400 bg-slate-300 p-4 shadow-inner custom-scrollbar text-slate-900">
                  {isTeamBreak ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {(groupBreak.teams || []).map(team => {
                              const isTaken = takenTeams.has(team.teamId);
                              const isSelected = selectedTeams.has(team.teamId);
                              return (
                                <button
                                    key={team.teamId}
                                    disabled={isTaken || isFull || groupBreak.status === 'completed'}
                                    onClick={() => handleTeamClick(team.teamId)}
                                    className={cn(
                                        "relative aspect-square rounded-2xl flex flex-col items-center justify-center p-4 text-center font-bold transition-all border-b-[6px] active:translate-y-1 active:border-b-0 group",
                                        isTaken ? "bg-slate-400/50 text-slate-600 border-transparent opacity-40 cursor-not-allowed" :
                                        isSelected ? "bg-slate-800 text-white border-black shadow-[0_0_20px_rgba(0,0,0,0.4)] z-10" :
                                        "bg-slate-100 border-slate-400 text-slate-800 hover:bg-white"
                                    )}
                                >
                                    <span className="text-sm font-black uppercase tracking-tight line-clamp-2">{team.name}</span>
                                    <div className={cn("font-code flex items-center gap-1.5 mt-2", isSelected ? "text-primary" : "text-primary/60")}>
                                        <span className="text-lg">{team.price.toLocaleString()}</span>
                                        {currency === 'diamond' ? <Gem className="w-3.5 h-3.5"/> : <PPlusIcon className="w-3.5 h-3.5" />}
                                    </div>
                                    {isTaken && <div className="absolute inset-0 bg-black/20 rounded-2xl" />}
                                </button>
                          )})}
                      </div>
                  ) : (
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
                        {Array.from({ length: groupBreak.totalSpots || 0 }).map((_, i) => {
                          const spotNumber = i + 1;
                          const isTaken = takenSpots.has(spotNumber);
                          const isSelected = selectedSpots.has(spotNumber);
                          return (
                            <button
                              key={spotNumber}
                              disabled={isTaken || isFull || groupBreak.status === 'completed'}
                              onClick={() => handleSpotClick(spotNumber)}
                              className={cn(
                                "relative aspect-square rounded-full flex items-center justify-center font-black text-xs transition-all border-b-4 active:translate-y-1 active:border-b-0",
                                isTaken ? "bg-slate-400/50 text-slate-600 border-transparent opacity-40" :
                                isSelected ? "bg-slate-800 text-white border-black shadow-[0_0_15px_rgba(0,0,0,0.4)]" :
                                "bg-slate-100 text-slate-800 border-slate-400 hover:border-slate-800"
                              )}
                            >
                                <span className="font-code">{spotNumber}</span>
                            </button>
                          );
                        })}
                      </div>
                  )}
              </ScrollArea>

              <div className="mt-8 space-y-6">
                <div className="flex justify-between items-end px-2">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">訂單明細摘要</p>
                        <p className="font-black text-slate-800 text-xl italic">已選數量: {selectionCount} 單位</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">總計需支付</p>
                        <div className={cn("flex items-center justify-end gap-2 text-xl sm:text-3xl font-black font-code text-slate-900 drop-shadow-sm")}>
                            {totalCost.toLocaleString()} {currency === 'diamond' ? <Gem className="h-5 w-5 text-primary"/> : <PPlusIcon className="h-5 w-5" />}
                        </div>
                    </div>
                </div>
                
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="lg" className="w-full h-16 text-xl font-black rounded-2xl bg-slate-800 text-white hover:bg-slate-950 shadow-xl active:scale-95 group transition-all" disabled={selectionCount === 0 || isSubmitting || isFull || groupBreak.status === 'completed'}>
                            <Zap className="mr-3 h-6 w-6 fill-white group-hover:scale-110 transition-transform" />
                            {isFull ? '頻道名額已滿' : '啟動連線並確認購買'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] bg-slate-200 border-slate-400 border-[10px] p-10 text-slate-900">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline font-black text-slate-800 uppercase text-2xl italic tracking-tighter">系統交易確認</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="text-slate-600 font-bold space-y-4">
                                    <p>確定要參與此團拆活動嗎？</p>
                                    <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left text-[11px] leading-relaxed space-y-1.5">
                                        <p className="font-black text-destructive flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> 購買條款告知：</p>
                                        <ul className="list-none pl-0 space-y-1 font-bold">
                                            <li>● 本站商品屬機率型抽選及數位內容，購買後即視為參與活動。</li>
                                            <li>● 本服務經提供即完成，依《消保法》不適用七日鑑賞期。</li>
                                            <li>● 請確認商品描述，並確保網路連線狀態穩定。</li>
                                            <li>● 在進行購買前,您需要完全同意本站的購買規則。一旦完成購買,即視同您已同意所有相關條款,不得以規則內容為由要求退換貨。</li>
                                            <li>● 請避免短時間內頻繁購買,否則可能因金流或銀行風險控管導致該帳戶暫時性凍結,建議您於消費前一次性購買足量點數。</li>
                                        </ul>
                                    </div>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-4 mt-6">
                            <AlertDialogCancel className="h-14 rounded-xl font-black bg-slate-400 border-none text-white">考慮一下</AlertDialogCancel>
                            <AlertDialogAction onClick={handlePurchase} disabled={isSubmitting} className="h-14 rounded-xl font-black bg-slate-800 text-white shadow-xl uppercase">
                                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                確定參與
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
          </div>
        </div>
      </div>

      {groupBreak.status === 'completed' && groupBreak.winnings && (
         <section className="mt-20 animate-fade-in-up">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-950 shadow-xl">
                    <Badge className="bg-primary text-primary-foreground">RESULT</Badge>
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-black font-headline text-white tracking-widest uppercase italic">官方開獎結果頻道</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1 opacity-60">Session Completion Registry</p>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent ml-4 hidden sm:block" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {groupBreak.winnings.map((winning, index) => (
                    <div 
                        key={index} 
                        className="flex items-center justify-between p-5 rounded-3xl bg-card/30 backdrop-blur-md border border-white/5 hover:border-primary/30 transition-all group shadow-xl cursor-zoom-in"
                        onClick={() => winning.cardId && setPreviewCard(winning)}
                    >
                        <div className="flex flex-col gap-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest truncate">{winning.teamName}</span>
                                {winning.cardId && <SearchCode className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                            <span className="text-base font-bold truncate group-hover:text-primary transition-colors">{winning.username}</span>
                        </div>
                        {winning.cardId ? (
                            <div className="relative w-10 h-14 rounded-lg overflow-hidden border border-white/10 shadow-lg group-hover:scale-110 transition-transform">
                                <SafeImage src={winning.cardImageUrl!} alt={winning.cardName!} fill className="object-cover" />
                            </div>
                        ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-500 opacity-20" />
                        )}
                    </div>
                ))}
            </div>
         </section>
      )}

      <div className="mt-12 text-center flex flex-col items-center opacity-20">
          <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Transmission Terminal • Verified Asset</p>
      </div>

      <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DialogContent className="max-w-[min(95vw,420px)] sm:max-w-md bg-transparent border-none shadow-none p-0 overflow-visible flex flex-col items-center gap-6 [&>button:last-child]:hidden">
            {previewCard && (
                <div className="w-full flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                    <h2 className="text-sm md:text-base font-black font-headline text-white drop-shadow-2xl tracking-tight leading-tight uppercase px-6 text-center max-w-[280px]">{previewCard.cardName}</h2>
                    
                    <div className="w-full max-w-[200px] sm:max-w-[230px] mx-auto relative group">
                        <div className="absolute -inset-4 bg-primary/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardItem 
                            name={previewCard.cardName!} 
                            imageUrl={previewCard.cardImageUrl!} 
                            backImageUrl={previewCard.cardBackImageUrl}
                            imageHint={previewCard.cardName!} 
                            rarity="rare" 
                            isFlippable={true}
                        />
                    </div>
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="flex items-center gap-3 mt-4">
                            <Badge className="bg-primary text-primary-foreground font-black tracking-widest px-4 py-1 text-[10px]">{previewCard.teamName}</Badge>
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-1 rounded-full text-[10px] font-code font-black text-white shadow-lg tracking-widest uppercase">
                                <Hash className="w-3 h-3 text-primary" />
                                {previewCard.userId.substring(0,4).toUpperCase()}
                            </div>
                        </div>
                        <p className="text-[9px] text-primary font-bold uppercase tracking-[0.2em] animate-pulse mt-2">獲獎藏家: {previewCard.username}</p>
                    </div>
                </div>
            )}
            <button 
                className="mt-4 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 h-12 w-12 shadow-2xl transition-all flex items-center justify-center"
                onClick={() => setPreviewCard(null)}
            >
                <X className="h-6 w-6" />
            </button>
        </DialogContent>
      </Dialog>

      <Dialog open={isRandomPickOpen} onOpenChange={setIsRandomPickOpen}>
        <DialogContent className="sm:max-w-xs rounded-[2.5rem] bg-slate-200 border-slate-400 border-[10px] p-10 text-slate-900">
            <DialogHeader>
                <DialogTitle className="font-headline font-black text-xl tracking-tighter text-slate-900 italic uppercase">輸入選號訊號</DialogTitle>
                <DialogDescription className="text-slate-700">請輸入欲自動選取的數量。</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
                <Input 
                    type="number" 
                    value={randomPickCount} 
                    onChange={(e) => setRandomPickCount(Math.max(1, Number(e.target.value)))} 
                    className="h-14 bg-black/10 border-none rounded-2xl font-code text-3xl font-black text-center text-slate-900"
                />
            </div>
            <DialogFooter className="sm:flex-col gap-2">
                <Button onClick={handleConfirmRandomPick} className="w-full h-14 font-black rounded-2xl bg-slate-800 text-white shadow-xl">執行自動分配</Button>
                <Button variant="ghost" onClick={() => setIsRandomPickOpen(false)} className="w-full h-10 font-bold text-slate-600">取消</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <VerifyAgeModal 
          isOpen={isAgeModalOpen}
          onClose={() => setIsAgeModalOpen(false)}
          onConfirm={() => {
              setIsAgeModalOpen(false);
              setIsVerified(true);
              handlePurchase();
          }}
      />
    </div>
  );
}
