export type EventName =
  | 'livestream.started'
  | 'livestream.ended'
  | 'livestream.gift_sent'
  | 'wallet.coins_purchased'
  | 'wallet.payout_requested';

export interface EventPayloadMap {
  'livestream.started': {
    streamId: string;
    hostId: string;
    title: string;
    category: string;
    startedAt: string;
  };
  'livestream.ended': {
    streamId: string;
    hostId: string;
    durationSeconds: number;
    totalEarnings: number;
    endedAt: string;
  };
  'livestream.gift_sent': {
    transactionId: string;
    streamId: string;
    senderId: string;
    receiverId: string;
    giftType: string;
    coinAmount: number;
    dollarValue: number;
    creatorEarnings: number;
    createdAt: string;
  };
  'wallet.coins_purchased': {
    userId: string;
    coinAmount: number;
    dollarAmount: number;
    paymentIntentId: string;
    purchasedAt: string;
  };
  'wallet.payout_requested': {
    userId: string;
    payoutId: string;
    amount: number;
    status: string;
    requestedAt: string;
  };
}

export type EventPayload<T extends EventName> = EventPayloadMap[T];

export interface EventMessage<T extends EventName = EventName> {
  id: string;
  event: T;
  payload: EventPayload<T>;
  timestamp: string;
  source: string;
}
