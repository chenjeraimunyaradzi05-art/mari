"use strict";
/**
 * Stories and Status Service - Stub Implementation
 * Stories, ephemeral content, status updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyService = exports.storyEvents = void 0;
const events_1 = require("events");
exports.storyEvents = new events_1.EventEmitter();
// In-memory storage
const stories = new Map();
const statuses = new Map();
const highlights = new Map();
const views = new Map();
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
exports.storyService = {
    async createStory(userId, data) {
        const story = {
            id: generateId(),
            userId,
            type: data.type,
            content: data.content,
            visibility: data.visibility || 'followers',
            expiresAt: new Date(Date.now() + (data.duration || 24) * 60 * 60 * 1000),
            createdAt: new Date(),
            viewCount: 0,
            reactions: [],
            replies: [],
            isHighlighted: false,
        };
        stories.set(story.id, story);
        exports.storyEvents.emit('story_created', { userId, storyId: story.id });
        return story;
    },
    async getUserStories(userId, _viewerId) {
        const now = new Date();
        return Array.from(stories.values())
            .filter(s => s.userId === userId && s.expiresAt > now)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async getStoriesFeed(userId, _options = {}) {
        const now = new Date();
        const userStories = Array.from(stories.values()).filter(s => s.expiresAt > now);
        const grouped = new Map();
        for (const story of userStories) {
            const list = grouped.get(story.userId) || [];
            list.push(story);
            grouped.set(story.userId, list);
        }
        return {
            stories: Array.from(grouped.entries()).map(([uid, storyList]) => ({
                userId: uid,
                user: { id: uid },
                stories: storyList,
            })),
        };
    },
    async viewStory(storyId, viewerId) {
        const viewSet = views.get(storyId) || new Set();
        if (!viewSet.has(viewerId)) {
            viewSet.add(viewerId);
            views.set(storyId, viewSet);
            const story = stories.get(storyId);
            if (story)
                story.viewCount++;
        }
    },
    async getStoryViewers(storyId, _userId) {
        const viewSet = views.get(storyId) || new Set();
        return { viewers: Array.from(viewSet).map(id => ({ id })), totalCount: viewSet.size };
    },
    async reactToStory(storyId, userId, emoji) {
        const story = stories.get(storyId);
        if (story) {
            story.reactions.push({ userId, emoji, createdAt: new Date() });
        }
    },
    async replyToStory(storyId, userId, text) {
        const reply = { id: generateId(), userId, text, createdAt: new Date() };
        const story = stories.get(storyId);
        if (story)
            story.replies.push(reply);
        return reply;
    },
    async deleteStory(storyId, userId) {
        const story = stories.get(storyId);
        if (story?.userId === userId)
            stories.delete(storyId);
    },
    async createHighlight(userId, data) {
        const highlight = { id: generateId(), userId, ...data, createdAt: new Date() };
        highlights.set(highlight.id, highlight);
        return highlight;
    },
    async getUserHighlights(userId) {
        return Array.from(highlights.values()).filter(h => h.userId === userId);
    },
    async updateStatus(userId, data) {
        const status = {
            id: generateId(),
            userId,
            type: data.type,
            status: data.status,
            emoji: data.emoji,
            expiresAt: data.duration ? new Date(Date.now() + data.duration * 60 * 60 * 1000) : undefined,
            createdAt: new Date(),
        };
        statuses.set(userId, status);
        return status;
    },
    async getUserStatus(userId) {
        const status = statuses.get(userId);
        if (!status)
            return null;
        if (status.expiresAt && status.expiresAt < new Date()) {
            statuses.delete(userId);
            return null;
        }
        return status;
    },
    async answerQuestion(_storyId, _userId, _answer, _anonymous = false) { },
    async votePoll(_storyId, _userId, _optionId) { },
    async cleanupExpiredStories() {
        const now = new Date();
        let count = 0;
        for (const [id, story] of stories) {
            if (story.expiresAt < now && !story.isHighlighted) {
                stories.delete(id);
                count++;
            }
        }
        return count;
    },
};
//# sourceMappingURL=story.service.js.map