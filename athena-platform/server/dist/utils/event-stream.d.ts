import { EventMessage, EventName, EventPayload } from '../types/events';
export declare function publishEvent<T extends EventName>(event: T, payload: EventPayload<T>, source?: string): Promise<boolean>;
export declare function ensureEventGroup(groupName?: string): Promise<void>;
export declare function consumeEvents(consumerName: string, handler: (event: EventMessage) => Promise<void>, options?: {
    groupName?: string;
    count?: number;
    blockMs?: number;
}): Promise<void>;
//# sourceMappingURL=event-stream.d.ts.map