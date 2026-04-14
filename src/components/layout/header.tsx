'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, Gem, LogIn, LogOut, ShieldCheck, Loader2, Package, Library, Plus, Users2, ChevronDown, Crown, ChevronRight, Info } from 'lucide-react';
import { Logo, CrossedCardsIcon, LuckyBagIcon, PPlusIcon } from '@/components/icons';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';
import React from 'react';
import { cn } from '@/lib/utils';
import { PurchasePointsDialog } from '@/components/purchase-points-dialog';
import type { SystemConfig } from '@/types/system';
import { MemberLevelCrown } from '@/components/member-level-crown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const navLinks = [
  { href: '/draw', label: '抽卡專區', icon: Package, color: "text-primary" },
  { href: '/bet', label: '拼卡專區', icon: CrossedCardsIcon, color: "text-destructive" },
  { href: '/lucky-bags', label: '福袋專區', icon: LuckyBagIcon, color: "text-accent" },
  { href: '/group-break', label: '團拆專區', icon: Users2, color: "text-green-400" },
  { href: '/collection', label: '收藏庫', icon: Library, color: "text-primary/70" },
  { href: '/vip', label: 'VIP', icon: Crown, color: "text-accent" },
  { href: '/about', label: '關於我們', icon: Info, color: "text-slate-400" },
];

export function Header({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center px-4 md:px-8">
        <div className="mr-auto flex items-center ml-1">
          <Logo className="text-primary" />
          <nav className="ml-6 hidden items-center space-x-6 text-sm font-medium md:flex">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 transition-all duration-300 hover:opacity-100",
                    isActive ? "text-foreground font-bold scale-105" : "text-muted-foreground opacity-70"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 transition-all duration-300", 
                    isActive ? link.color : "text-muted-foreground",
                    link.href === '/vip' && isActive && "fill-accent/20"
                  )} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-4">
            {user && userProfile?.role === 'admin' && (
              <Button variant="outline" size="sm" asChild className="hidden lg:flex rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5">
                <Link href="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  管理
                </Link>
              </Button>
            )}
             {user && (
                <div className="flex items-center">
                    <div className="flex items-center font-code text-[10px] sm:text-xs font-semibold bg-secondary/50 rounded-xl dark:bg-card/50 overflow-hidden border border-white/5 backdrop-blur-md shadow-lg">
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className="flex items-center px-3 sm:px-4 py-1.5 cursor-pointer hover:bg-white/5 transition-all group">
                                    <Gem className="mr-1.5 sm:mr-2 h-3.5 sm:h-4 w-3.5 sm:w-4 text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                                    <span className="text-foreground dark:text-white drop-shadow-md truncate min-w-[40px] max-w-[90px] sm:max-w-none text-center">
                                        {isProfileLoading ? '...' : (userProfile?.points ?? 0).toLocaleString()}
                                    </span>
                                    <ChevronDown className="ml-1 sm:ml-1.5 h-2.5 w-2.5 opacity-30 group-hover:opacity-100 group-hover:translate-y-0.5 transition-all" />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-5 bg-card/95 backdrop-blur-3xl border-primary/20 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200" align="end" sideOffset={12}>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">資產概覽概況</p>
                                        <div className="flex justify-between items-center pt-1">
                                            <span className="text-sm flex items-center gap-2 text-foreground/90 font-medium">
                                                <Gem className="w-4 h-4 text-primary"/> 鑽石餘額
                                            </span>
                                            <span className="font-black font-code text-lg text-foreground dark:text-white">{(userProfile?.points ?? 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <Separator className="bg-white/5" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm flex items-center gap-2 text-accent font-bold">
                                            <PPlusIcon className="w-4 h-4 animate-pulse"/> 紅利 P+ 點
                                        </span>
                                        <span className="font-black font-code text-lg text-accent">{(userProfile?.bonusPoints ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2">
                                        <Button variant="link" asChild className="w-full h-auto p-0 text-[10px] text-primary hover:text-white transition-colors">
                                            <Link href="/vip" className="flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest">
                                                升級階級權益 <ChevronRight className="w-3 h-3"/>
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <div className="border-l border-white/10">
                            <PurchasePointsDialog>
                                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-none hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all group">
                                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:scale-125 transition-transform" />
                                </Button>
                            </PurchasePointsDialog>
                        </div>
                    </div>
                </div>
            )}
          <div className="flex items-center">
              {isUserLoading ? (
                <div className="h-8 w-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : user ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <button className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:scale-105 transition-all active:scale-95 outline-none ml-1">
                        <MemberLevelCrown level={userProfile?.userLevel || '新手收藏家'} size="sm" />
                    </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="min-w-[200px] bg-card/95 backdrop-blur-3xl border-white/10 rounded-2xl shadow-2xl" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <p className="text-sm font-black leading-none text-white">{userProfile?.username || user.displayName || '新用戶'}</p>
                            <Badge variant="outline" className="text-[9px] font-black border-primary/30 text-primary uppercase tracking-tighter px-2 h-5">
                                {userProfile?.userLevel}
                            </Badge>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <div className="p-1.5">
                        {userProfile?.role === 'admin' && (
                            <DropdownMenuItem asChild className="rounded-xl focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                <Link href="/admin">
                                    <ShieldCheck className="mr-3 h-4 w-4" />
                                    <span className="font-bold">後台管理中心</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
                            <Link href="/profile" className="font-medium"><User className="mr-3 h-4 w-4" />會員中心</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl cursor-pointer md:hidden">
                            <Link href="/about" className="font-medium"><Info className="mr-3 h-4 w-4" />關於 P+Carder</Link>
                        </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <div className="p-1.5">
                        <DropdownMenuItem onClick={handleLogout} className="rounded-xl text-destructive focus:bg-destructive/10 focus:text-destructive font-bold cursor-pointer">
                            <LogOut className="mr-3 h-4 w-4" />
                            登出帳戶
                        </DropdownMenuItem>
                    </div>
                    </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild size="sm" className="h-9 px-4 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg">
                  <Link href="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    登入
                  </Link>
                </Button>
              )}
          </div>
        </div>
      </div>
    </header>
  );
}
