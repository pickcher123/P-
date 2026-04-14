'use client';

import { Crown, Sparkles, Star, Trophy } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * 自定義兩張卡牌交疊圖示 (用於卡牌大師)
 */
const TwoCardsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="6" width="11" height="15" rx="2" transform="rotate(-12 7.5 13.5)" />
    <rect x="11" y="3" width="11" height="15" rx="2" transform="rotate(12 16.5 10.5)" />
  </svg>
);

/**
 * 全站統一的 7 個等級樣式定義
 */
export const userLevels = [
    { 
        level: '新手收藏家', 
        threshold: 0, 
        color: 'text-slate-500', 
        border: 'border-slate-500/20', 
        glow: 'shadow-none', 
        bg: 'bg-slate-500/5',
        icon: Crown
    },
    { 
        level: '進階收藏家', 
        threshold: 15000, 
        color: 'text-slate-300', 
        border: 'border-slate-300/30', 
        glow: 'shadow-md shadow-slate-500/10', 
        bg: 'bg-slate-300/5',
        icon: Crown
    },
    { 
        level: '資深收藏家', 
        threshold: 50000, 
        color: 'text-amber-400', 
        border: 'border-amber-400/40', 
        glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]', 
        bg: 'bg-amber-400/5',
        icon: Crown
    },
    { 
        level: '卡牌大師', 
        threshold: 100000, 
        color: 'text-yellow-500', 
        border: 'border-yellow-500/50', 
        glow: 'shadow-[0_0_30px_rgba(234,179,8,0.4)]', 
        bg: 'bg-yellow-500/15', 
        animate: 'animate-pulse',
        icon: TwoCardsIcon
    },
    { 
        level: '殿堂級玩家', 
        threshold: 500000, 
        color: 'text-rose-500', 
        border: 'border-rose-500/60', 
        glow: 'shadow-[0_0_25px_rgba(244,63,94,0.4)]', 
        bg: 'bg-rose-500/15', 
        animate: 'animate-pulse',
        icon: Trophy
    },
    { 
        level: '傳奇收藏家', 
        threshold: 1000000, 
        color: 'text-purple-400', 
        border: 'border-purple-400/70', 
        glow: 'shadow-[0_0_35px_rgba(168,85,247,0.5)]', 
        bg: 'bg-purple-400/20', 
        animate: 'animate-pulse',
        icon: Crown
    },
    { 
        level: 'P+卡神', 
        threshold: 2000000, 
        color: 'text-primary', 
        border: 'border-primary', 
        glow: 'shadow-[0_0_45px_rgba(6,182,212,0.6)]', 
        bg: 'bg-primary/30', 
        animate: 'animate-bounce',
        icon: Crown
    },
];

interface MemberLevelCrownProps {
    level: string;
    showLabel?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function MemberLevelCrown({ level, showLabel = false, className, size = 'md' }: MemberLevelCrownProps) {
    const levelInfo = userLevels.find(l => l.level === level) || userLevels[0];
    const IconComponent = levelInfo.icon;
    
    const sizeClasses = {
        sm: 'w-10 h-10 border-[1.5px]',
        md: 'w-20 h-20 border-2',
        lg: 'w-52 h-52 border-4'
    };

    const iconSizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-10 h-10',
        lg: 'w-28 h-28'
    };

    const isHighLevel = level === '傳奇收藏家' || level === 'P+卡神' || level === '卡牌大師';

    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-1000",
                levelInfo.bg,
                levelInfo.border,
                levelInfo.glow,
                sizeClasses[size],
                isHighLevel && "ring-4 ring-offset-4 ring-offset-background ring-white/5"
            )}>
                {/* Progressive Aura Effect */}
                {isHighLevel && (
                    <div className={cn(
                        "absolute -inset-2 rounded-full border-2 border-dashed animate-spin-slow",
                        levelInfo.color,
                        "opacity-30"
                    )} />
                )}

                {/* Dynamic Starburst Effect */}
                {isHighLevel && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={cn("absolute w-full h-full rounded-full animate-ping opacity-20", levelInfo.bg)} />
                        <Sparkles className={cn("absolute -top-2 -right-2 w-1/3 h-1/3 animate-pulse", levelInfo.color)} />
                        <Sparkles className={cn("absolute -bottom-2 -left-2 w-1/4 h-1/4 animate-pulse delay-700", levelInfo.color)} />
                    </div>
                )}

                <IconComponent className={cn(
                    "drop-shadow-[0_0_10px_currentColor]", 
                    levelInfo.color, 
                    levelInfo.animate,
                    iconSizeClasses[size]
                )} />
            </div>

            {showLabel && (
                <div className={cn(
                    "px-4 py-1 rounded-full text-[10px] md:text-xs font-black font-headline tracking-[0.15em] bg-black/60 border backdrop-blur-sm whitespace-nowrap shadow-xl",
                    levelInfo.border,
                    levelInfo.color,
                    isHighLevel && "animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]"
                )}>
                    {level.toUpperCase()}
                </div>
            )}
        </div>
    );
}
