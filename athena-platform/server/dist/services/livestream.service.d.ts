export interface StreamKey {
    key: string;
    serverUrl: string;
    playbackUrl: string;
    expiresAt: Date;
}
export interface GiftTransaction {
    id: string;
    senderId: string;
    receiverId: string;
    streamId: string;
    giftType: string;
    coinAmount: number;
    dollarValue: number;
    createdAt: Date;
}
export interface WalletBalance {
    userId: string;
    coins: number;
    pendingEarnings: number;
    availableEarnings: number;
    lifetimeEarnings: number;
}
export interface GiftType {
    id: string;
    name: string;
    icon: string;
    coinCost: number;
    dollarValue: number;
    animation: string;
}
export declare const GIFT_CATALOG: GiftType[];
export declare function createStreamKey(userId: string): Promise<StreamKey>;
export declare function validateStreamKey(key: string): Promise<{
    valid: boolean;
    userId?: string;
}>;
export declare function revokeStreamKey(userId: string): Promise<void>;
export declare function startLiveStream(userId: string, data: {
    title: string;
    description?: string;
    thumbnailUrl?: string;
    category?: string;
}): Promise<any>;
export declare function endLiveStream(streamId: string, userId: string): Promise<any>;
export declare function updateViewerCount(streamId: string, count: number): Promise<void>;
export declare function getLiveStreams(options: {
    category?: string;
    limit?: number;
    cursor?: string;
}): Promise<{
    streams: any;
    nextCursor: any;
}>;
export declare function getWalletBalance(userId: string): Promise<WalletBalance>;
export declare function purchaseCoins(userId: string, amount: number, paymentIntentId: string): Promise<{
    coins: number;
    price: number;
}>;
export declare function sendGift(senderId: string, receiverId: string, streamId: string, giftTypeId: string): Promise<GiftTransaction>;
export declare function getStreamGifts(streamId: string): Promise<{
    gifts: {
        id: string;
        createdAt: Date;
        message: string | null;
        senderId: string;
        receiverId: string;
        giftType: string;
        giftValue: number;
        creatorShare: number;
        platformShare: number;
    }[];
    summary: {
        giftType: string;
        count: true | {
            id?: number | undefined;
            senderId?: number | undefined;
            receiverId?: number | undefined;
            giftType?: number | undefined;
            giftValue?: number | undefined;
            creatorShare?: number | undefined;
            platformShare?: number | undefined;
            message?: number | undefined;
            createdAt?: number | undefined;
            _all?: number | undefined;
        } | undefined;
        totalValue: any;
    }[];
    totalValue: number;
}>;
export declare function requestPayout(userId: string): Promise<any>;
export declare function processEarningsToAvailable(): Promise<{
    processed: number;
}>;
export declare function getGiftLeaderboard(streamId: string, limit?: number): Promise<{
    rank: number;
    user: {
        id: string;
        displayName: string | null;
        avatar: string | null;
    } | undefined;
    totalCoins: any;
    totalValue: any;
}[]>;
//# sourceMappingURL=livestream.service.d.ts.map