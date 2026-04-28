'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Image as ImageIcon, Wallpaper, Trash2, CheckCircle2, RefreshCw, Palette, BookOpen, Boxes, Loader2, Info, Layers } from 'lucide-react';
import { useFirestore, useDoc, useStorage, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState, ChangeEvent, useEffect, useCallback } from "react";
import { SafeImage } from "@/components/safe-image";
import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { SystemConfig } from "@/types/system";

interface BackgroundImage {
    url: string;
    ref: any;
}

export default function MaterialsAdminPage() {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
    const [selectedBgFile, setSelectedBgFile] = useState<File | null>(null);
    const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
    const [bgUploadProgress, setBgUploadProgress] = useState<number | null>(null);
    const [selectedOriginFile, setSelectedOriginFile] = useState<File | null>(null);
    const [originPreviewUrl, setOriginPreviewUrl] = useState<string | null>(null);
    const [originUploadProgress, setOriginUploadProgress] = useState<number | null>(null);
    const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
    const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(true);
    
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig, isLoading: isLoadingSystemConfig } = useDoc<SystemConfig>(systemConfigRef);
    
    const [currentOpacity, setCurrentOpacity] = useState(1);
    const [currentCardOpacity, setCurrentCardOpacity] = useState(0.85);

    useEffect(() => {
        if (systemConfig?.backgroundOpacity !== undefined) setCurrentOpacity(systemConfig.backgroundOpacity);
        if (systemConfig?.cardOpacity !== undefined) setCurrentCardOpacity(systemConfig.cardOpacity);
    }, [systemConfig]);

    const fetchBackgrounds = useCallback(async () => {
        if (!storage) return;
        setIsLoadingBackgrounds(true);
        try {
            const res = await listAll(ref(storage, 'P-Carder/backgrounds')).catch(() => ({ items: [] }));
            const list = await Promise.all(res.items.map(async (itemRef) => ({ url: await getDownloadURL(itemRef), ref: itemRef })));
            setBackgroundImages(list);
        } catch (e) { setBackgroundImages([]); } finally { setIsLoadingBackgrounds(false); }
    }, [storage]);

    useEffect(() => { if (storage) fetchBackgrounds(); }, [storage, fetchBackgrounds]);

    const handleUpload = async (type: 'logo' | 'bg' | 'origin') => {
        let file = type === 'logo' ? selectedLogoFile : type === 'bg' ? selectedBgFile : selectedOriginFile;
        if (!file || !systemConfigRef || !storage) return;
        const setProgress = type === 'logo' ? setLogoUploadProgress : type === 'bg' ? setBgUploadProgress : setOriginUploadProgress;
        setProgress(0);
        const folder = type === 'bg' ? 'backgrounds' : 'system';
        const fileRef = ref(storage, `P-Carder/${folder}/${type}-${uuidv4()}`);
        try {
            const uploadTask = uploadBytesResumable(fileRef, file);
            uploadTask.on('state_changed', (s) => setProgress((s.bytesTransferred / s.totalBytes) * 100), (e) => setProgress(null), async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                if (type === 'logo') await updateDoc(systemConfigRef, { logoUrl: url });
                else if (type === 'origin') await updateDoc(systemConfigRef, { aboutOriginImageUrl: url });
                else fetchBackgrounds();
                toast({ title: "成功" }); setProgress(null);
            });
        } catch(e) { setProgress(null); }
    }

    return (
        <div className="space-y-8 text-slate-900">
            <h1 className="text-3xl font-black tracking-tight">素材與視覺管理</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5 text-slate-400"/> 品牌標誌 (Logo)</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center p-4 relative overflow-hidden">
                            {systemConfig?.logoUrl ? <SafeImage src={systemConfig.logoUrl} alt="l" className="h-10 object-contain" width={100} height={40} /> : <span className="text-xs text-slate-300">目前無標誌</span>}
                        </div>
                        <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedLogoFile(e.target.files[0]); setLogoPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="text-xs h-12 border-slate-200" />
                        {logoPreviewUrl && <Button onClick={() => handleUpload('logo')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl" disabled={logoUploadProgress !== null}>{logoUploadProgress !== null ? `上傳中 ${Math.round(logoUploadProgress)}%` : '確認更換標誌'}</Button>}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-slate-400"/> 品牌故事圖片</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="aspect-video bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                            {systemConfig?.aboutOriginImageUrl ? <SafeImage src={systemConfig.aboutOriginImageUrl} alt="o" fill className="object-contain p-4" /> : <ImageIcon className="text-slate-200" />}
                        </div>
                        <Input type="file" onChange={e => { if(e.target.files?.[0]) { setSelectedOriginFile(e.target.files[0]); setOriginPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="text-xs h-12 border-slate-200" />
                        {originPreviewUrl && <Button onClick={() => handleUpload('origin')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl" disabled={originUploadProgress !== null}>上傳起源圖</Button>}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm rounded-2xl">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallpaper className="h-5 w-5 text-slate-400"/> 全站沉浸式背景庫</CardTitle></CardHeader>
                <CardContent className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-slate-500">上傳新背景</Label>
                            <Input type="file" onChange={e => { if(e.target.files?.[0]) { setSelectedBgFile(e.target.files[0]); setBgPreviewUrl(URL.createObjectURL(e.target.files[0])); }}} className="h-12 border-slate-200" />
                            {bgPreviewUrl && <Button onClick={() => handleUpload('bg')} className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl">加入背景庫</Button>}
                            <Button 
                                variant="outline" 
                                className="w-full h-12 border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200"
                                onClick={() => updateDoc(systemConfigRef!, { backgroundUrl: null })}
                            >
                                清除當前背景圖片 (點回無背景)
                            </Button>
                        </div>
                        <div className="space-y-6">
                            <div className="p-6 bg-slate-50 border rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold flex items-center gap-2 tracking-tight">
                                            <Layers className="w-4 h-4 text-primary" />
                                            首頁 3D 浮動卡片背景
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground">開啟後首頁將出現動態浮動卡片特效</p>
                                    </div>
                                    <Switch 
                                        checked={systemConfig?.showFloatingBackground !== false} 
                                        onCheckedChange={(v) => updateDoc(systemConfigRef!, { showFloatingBackground: v })} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-slate-500 flex justify-between">背景不透明度 <span>{Math.round(currentOpacity * 100)}%</span></Label>
                                <div className="p-6 bg-slate-50 border rounded-xl">
                                    <Slider value={[currentOpacity]} max={1} step={0.1} onValueChange={v => setCurrentOpacity(v[0])} onValueCommit={v => updateDoc(systemConfigRef!, { backgroundOpacity: v[0] })} />
                                </div>
                                <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-3">
                                    <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em] flex items-center gap-2"><Info className="w-3 h-3"/> 專業建議提示</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed italic font-medium">
                                        若您使用的背景圖片較為明亮或視覺雜亂，建議將不透明度調高至 <span className="text-white font-bold">85% 以上</span>，這能有效建立介面與背景的深度層次，確保玩家能輕鬆閱讀點數與獎項資訊。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {backgroundImages.map(img => (
                            <div key={img.url} className={cn("relative aspect-video rounded-xl border-2 transition-all cursor-pointer group", systemConfig?.backgroundUrl === img.url ? "border-slate-900 ring-2 ring-slate-100" : "border-slate-100")}>
                                <SafeImage src={img.url} alt="bg" fill className="object-cover rounded-lg" />
                                <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" onClick={() => updateDoc(systemConfigRef!, { backgroundUrl: img.url })}>套用</Button>
                                    <Button size="sm" variant="destructive" onClick={async () => { await deleteObject(img.ref); fetchBackgrounds(); }}><Trash2 size={14}/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
