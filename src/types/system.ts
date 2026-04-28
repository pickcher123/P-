export interface LevelBenefit {
    level: string;
    threshold: number;
    freeShipping: boolean;
    depositBonus: number; // 百分比，例如 5 代表 5%
    cashbackRate: number; // 百分比，例如 1 代表 1%
}

export interface SystemConfig {
    logoUrl?: string;
    backgroundUrl?: string;
    aboutOriginImageUrl?: string; // 新增：關於頁面起源圖片
    showFloatingBackground?: boolean; // 新增：首頁 3D 浮動卡片動態背景開關
    backgroundOpacity?: number;
    cardOpacity?: number; // 新增：遊戲卡片不透明度
    liveYoutubeUrl?: string;
    isLiveEnabled?: boolean;
    supportLineUrl?: string;
    isSupportEnabled?: boolean;
    communityUrl?: string;
    isCommunityEnabled?: boolean;
    featureFlags?: {
        isDrawEnabled?: boolean;
        isLuckyBagEnabled?: boolean;
        isBettingEnabled?: boolean;
        isGroupBreakEnabled?: boolean;
        isMarqueeEnabled?: boolean; // 新增：跑馬燈開關
    };
    levelBenefits?: LevelBenefit[];
}
