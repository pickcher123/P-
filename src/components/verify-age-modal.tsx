'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VerifyAgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function VerifyAgeModal({ isOpen, onClose, onConfirm }: VerifyAgeModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-[2.5rem] bg-slate-950/95 backdrop-blur-3xl border-rose-500/30 border-[10px] p-8 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline font-black text-rose-500 uppercase text-3xl italic tracking-tighter">限制級內容</AlertDialogTitle>
          <AlertDialogDescription className="text-white/80 font-bold space-y-4">
            <div>本專區包含限制級內容，僅供 18 歲以上人士觀看與參與。</div>
            <div>請確認您的年齡是否已滿 18 歲。</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 mt-6">
          <AlertDialogAction onClick={onClose} className="h-14 flex-1 rounded-2xl font-black bg-slate-800 text-white shadow-xl hover:bg-slate-700">未滿 18 歲 (離開)</AlertDialogAction>
          <AlertDialogAction onClick={onConfirm} className="h-14 flex-1 rounded-2xl font-black bg-rose-600 text-white shadow-xl hover:bg-rose-700">我已滿 18 歲 (進入)</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
