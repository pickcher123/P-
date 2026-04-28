'use client';

import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { RotateCw, Gem, Hash, Search } from 'lucide-react';

type Rarity = 'common' | 'rare' | 'legendary';

type CardItemProps = {
  name: string;
  imageUrl: string;
  backImageUrl?: string;
  imageHint: string;
  rarity?: Rarity;
  serialNumber?: string;
  isFlippable?: boolean;
  onFlip?: () => void;
  priority?: boolean;
};

const rarityStyles = {
  common: {
    glow: 'border-white/10',
    text: 'text-slate-300'
  },
  rare: {
    glow: 'border-primary/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
    text: 'text-primary'
  },
  legendary: {
    glow: 'border-accent/50 shadow-[0_0_25px_rgba(234,179,8,0.3)]',
    text: 'text-accent'
  },
};

export function CardItem({ name, imageUrl, backImageUrl, imageHint, rarity, serialNumber, isFlippable = true, onFlip, priority = false }: CardItemProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [backImgError, setBackImgError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fallbackUrl = 'https://picsum.photos/seed/card-fallback/400/600';
  const currentImageUrl = imgError ? fallbackUrl : imageUrl;
  const currentBackImageUrl = backImgError ? fallbackUrl : backImageUrl;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isFlippable) {
      e.stopPropagation();
      const newFlippedState = !isFlipped;
      setIsFlipped(newFlippedState);
      setZoomPos(null); // Reset zoom when flipping
      if (onFlip) {
        onFlip();
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isFlippable) return; // 收藏庫的一般卡片不可翻轉，所以直接返回
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);

    const zoomX = (x / rect.width) * 100;
    const zoomY = (y / rect.height) * 100;
    setZoomPos({ x: zoomX, y: zoomY });
  };

  const handleMouseLeave = () => {
    if (!isFlippable) return;
    setZoomPos(null);
  };

  const styles = rarity ? (rarityStyles[rarity] || rarityStyles.common) : rarityStyles.common;

  return (
    <div
      className="group w-full aspect-[2.5/4] [perspective:1200px]"
      onClick={handleCardClick}
      ref={containerRef}
    >
      <div
        className={cn(
          "relative w-full h-full rounded-xl transition-transform duration-700 [transform-style:preserve-3d] bg-transparent",
          isFlippable && "cursor-pointer",
          isFlipped ? '[transform:rotateY(180deg)_scale(0.8)]' : '[transform:rotateY(0deg)_scale(1)]'
        )}
      >
        {/* Card Front */}
         <div 
          className={cn(
            'absolute w-full h-full [backface-visibility:hidden] rounded-xl overflow-hidden border transition-all duration-300 bg-transparent',
            styles.glow,
          )}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="absolute inset-0 flex items-center justify-center p-1">
            <SafeImage
                src={imageUrl}
                alt={name}
                fill
                sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 15vw"
                className={cn(
                    "object-contain transition-all duration-300",
                    (zoomPos && !isFlipped) ? "opacity-0" : "opacity-100"
                )}
                data-ai-hint={imageHint}
                priority={priority}
                onError={() => setImgError(true)}
            />
            
          {/* Magnifying Glass Icon (Hover only) */}
          {!isFlippable && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                 <div className="p-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
                     <Search className="w-5 h-5 text-white" />
                 </div>
              </div>
          )}

          {/* Magnifying Glass Interaction Overlay (Zoom, only if flipped/flippable mode) */}
          {zoomPos && isFlippable && !isFlipped && (
                <div 
                    className="absolute inset-0 z-10 cursor-zoom-in"
                    style={{
                        backgroundImage: `url(${currentImageUrl})`,
                        backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                        backgroundSize: '250%',
                        backgroundRepeat: 'no-repeat'
                    }}
                >
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/20">
                        <Search className="w-3 h-3 text-white" />
                    </div>
                </div>
            )}
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent pointer-events-none" />
          
          {/* Digital Serial Number Badge */}
          {serialNumber && (
            <div className="absolute top-2.5 right-2.5 z-20">
              <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-xl border border-primary/40 px-2.5 py-1.5 rounded-lg text-[10px] md:text-[13px] font-code font-black text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] tracking-widest uppercase">
                <Hash className="w-3 h-3 md:w-4 md:h-4 text-primary animate-pulse" />
                {serialNumber}
              </div>
            </div>
          )}
          
          {isFlippable && (
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <div className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    <RotateCw className="w-3 h-3 text-white animate-spin-slow" />
                </div>
            </div>
          )}

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 [transform:translateZ(1px)] pointer-events-none">
             <div className="absolute inset-[-150%] rounded-full [background:radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(255,255,255,0.1),transparent_40%)]" 
                style={ { '--mouse-x': '0px', '--mouse-y': '0px' } as React.CSSProperties }
             />
          </div>
        </div>

        {/* Card Back */}
        <div 
          className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl overflow-hidden border border-white/5 bg-slate-950 backdrop-blur-md"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
           {backImageUrl ? (
             <div className="w-full h-full relative flex items-center justify-center p-1">
                <SafeImage
                    src={backImageUrl!}
                    alt={`${name} back`}
                    fill
                    className={cn(
                      "object-contain transition-all duration-300",
                      (zoomPos && isFlipped) ? "opacity-0" : "opacity-100"
                    )}
                    sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 15vw"
                    onError={() => setBackImgError(true)}
                />
                
                {/* Magnifying Glass Overlay (Back) */}
                {zoomPos && isFlipped && (
                    <div 
                        className="absolute inset-0 z-10 cursor-zoom-in"
                        style={{
                            backgroundImage: `url(${currentBackImageUrl})`,
                            backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                            backgroundSize: '250%',
                            backgroundRepeat: 'no-repeat'
                        }}
                    >
                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1 border border-white/20">
                            <Search className="w-3 h-3 text-white" />
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-0 right-0 text-center">
                    <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/30 italic">P+ Authentic Back</p>
                </div>
             </div>
           ) : (
             <div className="w-full h-full flex flex-col items-center justify-center p-4 relative rounded-xl bg-slate-900">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                <div className="relative flex flex-col items-center z-10">
                    <div className="p-3 rounded-full bg-primary/10 border border-primary/20 mb-2 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                        <Gem className="w-6 h-6 text-primary opacity-80" />
                    </div>
                    <span className="font-headline text-[10px] font-black text-primary tracking-[0.2em] opacity-60 italic mb-2">P+ CARDER</span>
                    <p className="text-xs font-black text-white px-4 text-center line-clamp-2">{name}</p>
                    <div className="mt-4 text-[8px] text-muted-foreground uppercase tracking-[0.4em] font-code opacity-40">Verified Digital Asset</div>
                </div>
                <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-primary/20" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-primary/20" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-primary/20" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-primary/20" />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}