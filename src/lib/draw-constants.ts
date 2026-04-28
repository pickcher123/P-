export const rarityVisuals: Record<string, { color: string, glow: string, celebration: 'none' | 'rare' | 'legendary', label: string }> = {
  legendary: { color: 'text-accent', glow: 'shadow-[0_0_60px_rgba(234,179,8,0.6)]', celebration: 'legendary', label: 'LEGENDARY' },
  rare: { color: 'text-primary', glow: 'shadow-[0_0_50px_rgba(6,182,212,0.5)]', celebration: 'rare', label: 'RARE' },
  common: { color: 'text-slate-400', glow: 'shadow-white/5', celebration: 'none', label: 'COMMON' },
};

export const pointPrizeRarityStyles: Record<string, { text: string, bg: string, border: string }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10 backdrop-blur-xl', border: 'border-accent/30' },
  rare: { text: 'text-primary', bg: 'bg-primary/10 backdrop-blur-xl', border: 'border-primary/30' },
  common: { text: 'text-slate-400', bg: 'bg-white/5 backdrop-blur-xl', border: 'border-white/10' },
};
