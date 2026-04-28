'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CelebrationVFXProps {
  type: 'none' | 'rare' | 'legendary';
}

interface StarProp {
  id: number;
  rotation: number;
  translation: number;
  delay: number;
  size: string;
}

export function CelebrationVFX({ type }: CelebrationVFXProps) {
  const isNone = type === 'none';
  const isLegendary = type === 'legendary';
  const colorClass = isLegendary ? 'text-accent' : 'text-primary';
  const glowColor = isLegendary ? 'rgba(234,179,8,0.3)' : 'rgba(6,182,212,0.15)';
  const starCount = isLegendary ? 45 : 30;

  // Memoize star properties to avoid recalculating on every re-render while active
  const stars = useMemo(() => {
    if (isNone) return [];
    return Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      rotation: i * (360 / starCount),
      translation: 60 + Math.random() * (isLegendary ? 400 : 250),
      delay: Math.random() * 0.8,
      size: isLegendary ? "w-5 h-5 md:w-7 md:h-7" : "w-3 h-3 md:w-5 md:h-5",
    }));
  }, [starCount, isLegendary, isNone]);

  if (isNone) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      <div className={cn("absolute inset-0 transition-opacity duration-2000", isLegendary ? "bg-accent/10" : "bg-primary/5")} />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full animate-glow-burst" 
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }} 
      />
      {stars.map((star) => (
        <div 
          key={star.id} 
          className={cn("absolute animate-firework", colorClass)}
          style={{ 
            left: '50%', 
            top: '50%',
            transform: `rotate(${star.rotation}deg) translate(${star.translation}px)`,
            animationDelay: `${star.delay}s`,
            opacity: 0
          }}
        >
          <Star className={cn(star.size, "fill-current")} />
        </div>
      ))}
    </div>
  );
}
