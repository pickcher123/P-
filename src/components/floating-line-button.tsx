'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { X, MessageCircleCode, Radio, Users } from 'lucide-react';
import type { SystemConfig } from '@/types/system';

export function FloatingLineButton({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const [isLiveVisible, setIsLiveVisible] = useState(true);
  const [isSupportVisible, setIsSupportVisible] = useState(true);
  const [isCommunityVisible, setIsCommunityVisible] = useState(true);

  // Reset visibility if config changes
  useEffect(() => {
    setIsLiveVisible(true);
    setIsSupportVisible(true);
    setIsCommunityVisible(true);
  }, [systemConfig?.isLiveEnabled, systemConfig?.liveYoutubeUrl, systemConfig?.isSupportEnabled, systemConfig?.supportLineUrl, systemConfig?.isCommunityEnabled, systemConfig?.communityUrl]);

  if (!isLiveVisible && !isSupportVisible && !isCommunityVisible) return null;

  return (
    <div className={cn(
      "fixed right-4 bottom-20 md:right-8 md:bottom-8 z-50",
      "flex flex-col gap-4 items-end"
    )}>
      {/* Live 直播跳球 */}
      {systemConfig?.isLiveEnabled && systemConfig.liveYoutubeUrl && isLiveVisible && (
        <div className="relative group/live">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsLiveVisible(false);
            }}
            className={cn(
              "absolute -top-2 -right-2 z-[60] p-1 rounded-full border",
              "bg-background/80 backdrop-blur-md border-white/20 text-muted-foreground",
              "hover:bg-destructive hover:text-destructive-foreground transition-all duration-200",
              "opacity-0 group-hover/live:opacity-100 shadow-lg"
            )}
            title="隱藏直播球"
          >
            <X className="w-3 h-3" />
          </button>

          <Link
            href={systemConfig.liveYoutubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 md:w-16 md:h-16",
              "rounded-full shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all duration-300",
              "bg-red-600/90 backdrop-blur-xl border border-red-400/50",
              "hover:scale-110 active:scale-95",
              "hover:bg-red-600 hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]"
            )}
          >
            <div className="relative">
              <Radio className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white shadow-sm"></span>
              </span>
            </div>
            <span className="text-[8px] md:text-[9px] font-black text-white mt-0.5 whitespace-nowrap uppercase tracking-tighter">
              LIVE
            </span>
          </Link>
        </div>
      )}

      {/* 客服跳球 */}
      {systemConfig?.isSupportEnabled && systemConfig.supportLineUrl && isSupportVisible && (
        <div className="relative group/support">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsSupportVisible(false);
            }}
            className={cn(
              "absolute -top-2 -right-2 z-[60] p-1 rounded-full border",
              "bg-background/80 backdrop-blur-md border-white/20 text-muted-foreground",
              "hover:bg-destructive hover:text-destructive-foreground transition-all duration-200",
              "opacity-0 group-hover/support:opacity-100 shadow-lg"
            )}
            title="隱藏客服球"
          >
            <X className="w-3 h-3" />
          </button>

          <Link
            href={systemConfig.supportLineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 md:w-16 md:h-16",
              "rounded-full shadow-[0_0_20px_rgba(6,199,85,0.3)] transition-all duration-300",
              "bg-black/40 backdrop-blur-xl border border-[#06C755]/50",
              "hover:scale-110 active:scale-95",
              "hover:border-[#06C755] hover:shadow-[0_0_30px_rgba(6,199,85,0.6)]"
            )}
          >
            <div className="relative">
              <MessageCircleCode className="w-6 h-6 md:w-8 md:h-8 text-[#06C755] drop-shadow-[0_0_8px_rgba(6,199,85,0.8)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06C755] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#06C755] shadow-sm"></span>
              </span>
            </div>
            <span className="text-[8px] md:text-[9px] font-black text-[#06C755] mt-0.5 whitespace-nowrap uppercase tracking-tighter">
              Support
            </span>
          </Link>
        </div>
      )}

      {/* 社群跳球 */}
      {systemConfig?.isCommunityEnabled && systemConfig.communityUrl && isCommunityVisible && (
        <div className="relative group/community">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsCommunityVisible(false);
            }}
            className={cn(
              "absolute -top-2 -right-2 z-[60] p-1 rounded-full border",
              "bg-background/80 backdrop-blur-md border-white/20 text-muted-foreground",
              "hover:bg-destructive hover:text-destructive-foreground transition-all duration-200",
              "opacity-0 group-hover/community:opacity-100 shadow-lg"
            )}
            title="隱藏社群球"
          >
            <X className="w-3 h-3" />
          </button>

          <Link
            href={systemConfig.communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center justify-center w-12 h-12 md:w-16 md:h-16",
              "rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300",
              "bg-black/40 backdrop-blur-xl border border-blue-500/50",
              "hover:scale-110 active:scale-95",
              "hover:border-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]"
            )}
          >
            <div className="relative">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 shadow-sm"></span>
              </span>
            </div>
            <span className="text-[8px] md:text-[9px] font-black text-blue-500 mt-0.5 whitespace-nowrap uppercase tracking-tighter">
              Community
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
