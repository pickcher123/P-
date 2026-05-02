export type Rarity = 'legendary' | 'rare' | 'common';

export interface Card {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    category: string;
    sellPrice?: number;
    isSold?: boolean;
}

export interface PointPrize {
    prizeId: string;
    points: number;
    quantity: number;
    rarity: Rarity;
}

export interface CardPool {
    id: string;
    price?: number;
    price3Draws?: number;
    cards: { cardId: string; quantity: number }[];
    pointPrizes?: PointPrize[];
    cardRarities: Record<string, Rarity>;
    remainingPacks: number;
    totalPacks?: number;
    hasProtection?: boolean;
    currency?: 'diamond' | 'p-point';
    type?: string;
    name?: string;
    categoryId?: string;
    lastPrizeCardId?: string;
    lockedBy?: string;
    lockedAt?: { seconds: number; nanoseconds: number; };
    dailyLimit?: number;
    minLevel?: string;
    isAdult?: boolean;
}

export type DrawnPrize = (Card & { rarity: Rarity; type: 'card' | 'last-prize'; serialNumber?: string }) | (PointPrize & { type: 'points'; rarity: Rarity });

export type Step = 'init-loading' | 'waiting-to-start' | 'loading' | 'ready-to-reveal' | 'revealing' | 'done' | 'error';
