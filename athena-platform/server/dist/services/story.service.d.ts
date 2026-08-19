/**
 * Stories and Status Service - Stub Implementation
 * Stories, ephemeral content, status updates
 */
import { EventEmitter } from 'events';
export declare const storyEvents: EventEmitter<[never]>;
export interface Story {
    id: string;
    userId: string;
    type: 'image' | 'video' | 'text' | 'poll' | 'question' | 'link';
    content: Record<string, unknown>;
    visibility: 'public' | 'followers' | 'close_friends' | 'connections';
    expiresAt: Date;
    createdAt: Date;
    viewCount: number;
    reactions: unknown[];
    replies: unknown[];
    isHighlighted: boolean;
    highlightId?: string;
}
export interface StatusUpdate {
    id: string;
    userId: string;
    type: 'availability' | 'activity' | 'milestone' | 'mood' | 'custom';
    status: string;
    emoji?: string;
    expiresAt?: Date;
    createdAt: Date;
}
export interface StoryHighlight {
    id: string;
    userId: string;
    title: string;
    coverUrl?: string;
    storyIds: string[];
    createdAt: Date;
}
export declare const storyService: {
    createStory(userId: string, data: {
        type: Story["type"];
        content: Record<string, unknown>;
        visibility?: Story["visibility"];
        duration?: number;
    }): Promise<Story>;
    getUserStories(userId: string, _viewerId?: string): Promise<Story[]>;
    getStoriesFeed(userId: string, _options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        stories: {
            userId: string;
            user: unknown;
            stories: Story[];
        }[];
        nextCursor?: string;
    }>;
    viewStory(storyId: string, viewerId: string): Promise<void>;
    getStoryViewers(storyId: string, _userId: string): Promise<{
        viewers: unknown[];
        totalCount: number;
    }>;
    reactToStory(storyId: string, userId: string, emoji: string): Promise<void>;
    replyToStory(storyId: string, userId: string, text: string): Promise<{
        id: string;
        userId: string;
        text: string;
        createdAt: Date;
    }>;
    deleteStory(storyId: string, userId: string): Promise<void>;
    createHighlight(userId: string, data: {
        title: string;
        coverUrl?: string;
        storyIds: string[];
    }): Promise<StoryHighlight>;
    getUserHighlights(userId: string): Promise<StoryHighlight[]>;
    updateStatus(userId: string, data: {
        type: StatusUpdate["type"];
        status: string;
        emoji?: string;
        duration?: number;
    }): Promise<StatusUpdate>;
    getUserStatus(userId: string): Promise<StatusUpdate | null>;
    answerQuestion(_storyId: string, _userId: string, _answer: string, _anonymous?: boolean): Promise<void>;
    votePoll(_storyId: string, _userId: string, _optionId: string): Promise<void>;
    cleanupExpiredStories(): Promise<number>;
};
//# sourceMappingURL=story.service.d.ts.map