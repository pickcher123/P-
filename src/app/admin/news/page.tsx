'use client';

import { useState, useMemo, ChangeEvent, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
import { PlusCircle, Edit, Trash2, Image as ImageIcon, FileText, Loader2, Megaphone, Radio, MessageCircleCode, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';

interface NewsItem {
    id?: string;
    title: string;
    content: string;
    category: string;
    imageUrl?: string;
    type: 'text' | 'image';
    createdAt?: { seconds: number };
    isPinned?: boolean;
    isMarquee?: boolean;
}

const CATEGORIES = ["系統公告", "遊戲更新", "活動快訊", "維護通知"];

export default function NewsAdminPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<NewsItem>>({ 
    title: '', 
    category: '系統公告', 
    type: 'text', 
    isPinned: false,
    isMarquee: false 
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);

  useEffect(() => {
    if (!systemConfigRef) return;
    getDoc(systemConfigRef).then(doc => {
        if (doc.exists()) setSystemConfig(doc.data() as SystemConfig);
    });
  }, [systemConfigRef]);

  const newsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'news'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const { data: newsItems, isLoading, forceRefetch } = useCollection<NewsItem>(newsQuery);

  const sortedNews = useMemo(() => {
    if (!newsItems) return [];
    return [...newsItems].sort((a, b) => (a.isPinned ? -1 : 1) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [newsItems]);

  const handleSave = async () => {
    if (!firestore || !currentItem.title) return;
    setIsProcessing(true);
    try {
        let imageUrl = currentItem.imageUrl || '';
        if (selectedFile && storage) {
            setUploadProgress(0);
            const fileRef = ref(storage, `P-Carder/news/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(fileRef, selectedFile);
            imageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
            });
        }
        const data = { 
            ...currentItem, 
            imageUrl, 
            isMarquee: currentItem.isMarquee || false,
            isPinned: currentItem.isPinned || false,
            createdAt: currentItem.createdAt || serverTimestamp() 
        };
        if (isEditMode && currentItem.id) await updateDoc(doc(firestore, 'news', currentItem.id), data);
        else await addDoc(collection(firestore, 'news'), data);
        setIsDialogOpen(false); setUploadProgress(null); setSelectedFile(null);
        toast({ title: '成功' });
        if(forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive' });
    } finally { setIsProcessing(false); }
  };

  const handleToggleField = async (id: string, field: 'isPinned' | 'isMarquee', value: boolean) => {
    if (!firestore) return;
    try {
        await updateDoc(doc(firestore, 'news', id), { [field]: value });
        toast({ title: '狀態已更新' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive' });
    }
  };

  const updateSystemConfig = async (data: Partial<SystemConfig>) => {
    if (!systemConfigRef) return;
    await updateDoc(systemConfigRef, data);
    setSystemConfig(prev => prev ? {...prev, ...data} : null);
  };

  return (
    <div className="space-y-8 text-slate-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Radio className="h-5 w-5 text-slate-400"/> 直播球設定</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="live-toggle" className="text-sm font-bold">啟用直播球</Label>
                        <Switch id="live-toggle" checked={systemConfig?.isLiveEnabled || false} onCheckedChange={(v) => updateSystemConfig({ isLiveEnabled: v })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="live-url" className="text-xs font-bold text-slate-500">直播連結 (YouTube URL)</Label>
                        <Input id="live-url" value={systemConfig?.liveYoutubeUrl || ''} onChange={e => updateSystemConfig({ liveYoutubeUrl: e.target.value })} className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900" placeholder="https://youtube.com/..." />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageCircleCode className="h-5 w-5 text-slate-400"/> 客服球設定</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="support-toggle" className="text-sm font-bold">啟用客服球</Label>
                        <Switch id="support-toggle" checked={systemConfig?.isSupportEnabled || false} onCheckedChange={(v) => updateSystemConfig({ isSupportEnabled: v })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="support-url" className="text-xs font-bold text-slate-500">客服連結 (Line URL)</Label>
                        <Input id="support-url" value={systemConfig?.supportLineUrl || ''} onChange={e => updateSystemConfig({ supportLineUrl: e.target.value })} className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900" placeholder="https://line.me/..." />
                    </div>
                </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-slate-400"/> 社群球設定</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="community-toggle" className="text-sm font-bold">啟用社群球</Label>
                        <Switch id="community-toggle" checked={systemConfig?.isCommunityEnabled || false} onCheckedChange={(v) => updateSystemConfig({ isCommunityEnabled: v })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="community-url" className="text-xs font-bold text-slate-500">社群連結 (URL)</Label>
                        <Input id="community-url" value={systemConfig?.communityUrl || ''} onChange={e => updateSystemConfig({ communityUrl: e.target.value })} className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900" placeholder="https://..." />
                    </div>
                </CardContent>
            </Card>
        </div>
       <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black tracking-tight">消息發布管理</h1>
                <p className="text-sm text-slate-500 font-bold mt-1">控制消息在首頁列表或全站跑馬燈的顯示狀態。</p>
            </div>
            <Button onClick={() => { setIsEditMode(false); setCurrentItem({title: '', category: '系統公告', type: 'text', isPinned: false, isMarquee: false}); setPreviewUrl(null); setIsDialogOpen(true); }} className="bg-slate-900 text-white rounded-xl font-bold h-12 px-6 shadow-xl"><PlusCircle className="mr-2 h-4 w-4" /> 新增消息</Button>
        </div>

        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                    <TableHead className="w-16 text-center text-[10px] font-black uppercase py-5">模式</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">標題內容</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">分類</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">跑馬燈</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">置頂</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={6} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>) : 
                sortedNews.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100 group">
                    <TableCell className="py-4">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                            {item.type === 'image' ? <ImageIcon size={16}/> : <FileText size={16}/>}
                        </div>
                    </TableCell>
                    <TableCell>
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="text-[10px] text-slate-400 font-code">{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-black border-slate-200 text-slate-500 uppercase">{item.category}</Badge></TableCell>
                    <TableCell className="text-center">
                        <Switch 
                            checked={item.isMarquee || false} 
                            onCheckedChange={(v) => handleToggleField(item.id!, 'isMarquee', v)} 
                            className="data-[state=checked]:bg-amber-500"
                        />
                    </TableCell>
                    <TableCell className="text-center">
                        <Switch 
                            checked={item.isPinned || false} 
                            onCheckedChange={(v) => handleToggleField(item.id!, 'isPinned', v)} 
                        />
                    </TableCell>
                    <TableCell className="text-right pr-8 space-x-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100" onClick={() => { setCurrentItem(item); setPreviewUrl(item.imageUrl || null); setIsEditMode(true); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black text-xl">確認刪除消息？</AlertDialogTitle>
                                    <AlertDialogDescription className="font-bold text-slate-500">此動作將永久移除「{item.title}」，無法復原。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3">
                                    <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteDoc(doc(firestore!, 'news', item.id!))} className="rounded-xl bg-red-600 font-black px-8 border-none shadow-xl text-white">確認刪除</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
            {!isLoading && newsItems?.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-bold italic">目前尚無發布的消息公告</div>
            )}
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={(v) => !isProcessing && setIsDialogOpen(v)}>
            <DialogContent className="light sm:max-w-2xl bg-white border-none shadow-2xl p-8 rounded-[2.5rem] text-slate-900 overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">{isEditMode ? '修改消息內容' : '發布全新消息'}</DialogTitle>
                    <DialogDescription className="font-medium text-slate-500">設定消息的內容、類別以及在跑馬燈的顯示狀態。</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6 overflow-y-auto max-h-[70vh] pr-2">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">消息標題</Label>
                        <Input value={currentItem.title} onChange={e => setCurrentItem({...currentItem, title: e.target.value})} className="h-14 border-slate-200 rounded-2xl font-bold text-lg bg-white text-slate-900" placeholder="輸入吸引人的標題" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類</Label>
                            <Select value={currentItem.category} onValueChange={v => setCurrentItem({...currentItem, category: v})}>
                                <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">呈現類型</Label>
                            <Select value={currentItem.type} onValueChange={(v:any) => setCurrentItem({...currentItem, type: v})}>
                                <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl"><SelectItem value="text" className="font-bold">純文字模式</SelectItem><SelectItem value="image" className="font-bold">純圖片模式 (活動 Banner)</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center space-x-3 flex-1 border-r border-slate-200">
                            <Switch id="marquee-toggle" checked={currentItem.isMarquee || false} onCheckedChange={(v) => setCurrentItem({...currentItem, isMarquee: v})} className="data-[state=checked]:bg-amber-500" />
                            <div className="space-y-0.5">
                                <Label htmlFor="marquee-toggle" className="text-sm font-black cursor-pointer">顯示於跑馬燈</Label>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Marquee Push</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3 flex-1">
                            <Switch id="pin-toggle" checked={currentItem.isPinned || false} onCheckedChange={(v) => setCurrentItem({...currentItem, isPinned: v})} />
                            <div className="space-y-0.5">
                                <Label htmlFor="pin-toggle" className="text-sm font-black cursor-pointer">列表置頂顯示</Label>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pinned Priority</p>
                            </div>
                        </div>
                    </div>

                    {currentItem.type === 'text' ? (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">內容正文 (支援 HTML)</Label>
                            <Textarea value={currentItem.content} onChange={e => setCurrentItem({...currentItem, content: e.target.value})} className="min-h-[250px] border-slate-200 rounded-2xl font-medium p-4 bg-white text-slate-900" placeholder="詳細的消息描述內容..." />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">圖片素材上傳</Label>
                            <div className="flex flex-col gap-4">
                                <div className="aspect-video relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center group">
                                    {previewUrl ? (
                                        <SafeImage src={previewUrl} alt="p" fill className="object-contain p-2" />
                                    ) : (
                                        <div className="text-center space-y-2">
                                            <ImageIcon className="h-10 w-10 text-slate-200 mx-auto" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Image Selected</p>
                                        </div>
                                    )}
                                </div>
                                <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 h-10 file:font-black bg-white" />
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <Progress value={uploadProgress} className="h-1.5 bg-slate-100" />
                                        <p className="text-[10px] text-center font-black text-primary uppercase tracking-widest">{Math.round(uploadProgress)}% UPLOADING</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="pt-6 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="font-bold">取消</Button>
                    <Button onClick={handleSave} disabled={isProcessing || !currentItem.title} className="h-14 px-12 rounded-2xl font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all text-lg">
                        {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : (isEditMode ? '儲存變更並更新' : '確認發布訊息')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
