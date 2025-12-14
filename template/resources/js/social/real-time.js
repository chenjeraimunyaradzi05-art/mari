/**
 * Real-time Updates Module
 * Handles WebSocket connections, notifications, and live updates
 */

class RealTimeUpdates {
    constructor() {
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        this.currentUserId = this.resolveUserId();
        this.pollInterval = 5000; // 5 seconds
        this.pollTimer = null;
        this.channel = null;
        this.privacyPlaceholder = 'Message hidden for privacy.';

        this.bootstrap();
    }

    bootstrap() {
        if (this.canUseBroadcasting()) {
            this.initBroadcasting();
        } else {
            this.initPolling();
        }

        this.setupPushNotifications();
        this.checkForNewNotifications();
    }

    resolveUserId() {
        if (window.currentUserId) {
            return Number(window.currentUserId);
        }

        const meta = document.querySelector('meta[name="user-id"]');
        if (meta?.content) {
            return Number(meta.content);
        }

        return null;
    }

    canUseBroadcasting() {
        return typeof window.Echo !== 'undefined' && Number.isInteger(this.currentUserId);
    }

    /**
     * Initialize polling for updates
     */
    initPolling() {
        this.stopPolling();

        this.pollTimer = setInterval(() => {
            this.checkForNewNotifications();
            this.checkForNewMessages();
            this.checkForNewActivity();
        }, this.pollInterval);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    initBroadcasting() {
        const channelName = `social.user.${this.currentUserId}`;

        try {
            this.channel = window.Echo.private(channelName)
                .listen('.social.post.created', (payload) => this.handlePostCreated(payload))
                .listen('.social.post.shared', (payload) => this.handlePostShared(payload))
                .listen('.social.post.moderated', (payload) => this.handlePostModerated(payload))
                .listen('.social.post.deleted', (payload) => this.handlePostDeleted(payload))
                .listen('.social.messaging.message-created', (payload) => this.handleConversationMessageCreated(payload))
                .error((error) => {
                    console.warn('Realtime channel error, falling back to polling.', error);
                    this.emitRealtimeFallback('channel-error');
                    this.initPolling();
                });

            // Keep lightweight polling for other notification types until dedicated events exist
            this.initPolling();
        } catch (error) {
            console.error('Unable to subscribe to realtime feed:', error);
            this.emitRealtimeFallback('subscription-error');
            this.initPolling();
        }
    }

    emitRealtimeFallback(reason) {
        document.dispatchEvent(new CustomEvent('realtime:fallback', {
            detail: { reason }
        }));
    }

    /**
     * Check for new notifications
     */
    async checkForNewNotifications() {
        try {
            const response = await fetch('/member/notifications/new', {
                headers: { 'X-CSRF-TOKEN': this.csrfToken }
            });
            const data = await response.json();

            if (data.count > 0) {
                this.updateNotificationBadge(data.count);
                this.showNotificationToast(data.notifications);
            }
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
    }

    /**
     * Check for new messages
     */
    async checkForNewMessages() {
        try {
            const response = await fetch('/member/messages/new', {
                headers: { 'X-CSRF-TOKEN': this.csrfToken }
            });
            const data = await response.json();

            if (data.count > 0) {
                this.updateMessageBadge(data.count);
                this.showMessageNotification(data.messages);
                this.updateConversationList(data.messages);
            }
        } catch (error) {
            console.error('Error checking messages:', error);
        }
    }

    /**
     * Check for new activity
     */
    async checkForNewActivity() {
        try {
            const response = await fetch('/member/social/new-activity', {
                headers: { 'X-CSRF-TOKEN': this.csrfToken }
            });
            const data = await response.json();

            if (data.hasActivity) {
                this.updateActivityFeed(data.activity);
            }
        } catch (error) {
            console.error('Error checking activity:', error);
        }
    }

    /**
     * Update notification badge
     */
    updateNotificationBadge(count) {
        const badges = document.querySelectorAll('[data-notification-count]');
        badges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        });
    }

    /**
     * Update message badge
     */
    updateMessageBadge(count) {
        const badges = document.querySelectorAll('[data-message-count]');
        badges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        });
    }

    /**
     * Show notification toast
     */
    showNotificationToast(notifications) {
        const container = document.body;

        notifications.slice(0, 3).forEach((notif, index) => {
            const toast = this.createToastElement('notification', notif, index);
            container.appendChild(toast);

            // Auto remove after 5 seconds
            setTimeout(() => toast.remove(), 5000);
        });
    }

    /**
     * Show message notification
     */
    showMessageNotification(messages) {
        messages.slice(0, 2).forEach((msg, index) => {
            const safeMessage = {
                ...msg,
                sender: {
                    avatar_url: msg?.sender?.avatar_url ?? '',
                    name: msg?.sender?.name
                        ?? msg?.sender?.display_name
                        ?? msg?.sender?.username
                        ?? 'New message',
                },
                content: this.resolveMessagePreview(msg),
            };

            const toast = this.createToastElement('message', safeMessage, index);
            document.body.appendChild(toast);

            // Auto remove after 6 seconds
            setTimeout(() => toast.remove(), 6000);
        });
    }

    /**
     * Create toast element
     */
    createToastElement(type, data, index) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: ${20 + (index * 350)}px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            min-width: 300px;
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        `;

        if (type === 'notification') {
            toast.innerHTML = `
                <div class="flex items-start gap-3">
                    <img src="${data.avatar_url}" alt="" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                    <div class="flex-1">
                        <h6 class="font-bold">${data.title}</h6>
                        <p class="text-sm opacity-90">${data.message}</p>
                    </div>
                    <button onclick="this.parentElement.remove()" class="ml-2 text-lg opacity-75 hover:opacity-100">×</button>
                </div>
            `;
        } else if (type === 'message') {
            const avatar = this.escapeHtml(data?.sender?.avatar_url ?? '');
            const senderName = this.escapeHtml(data?.sender?.name ?? 'New message');
            const preview = this.escapeHtml(data?.content ?? '');
            toast.innerHTML = `
                <div class="flex items-start gap-3">
                    <img src="${avatar}" alt="" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                    <div class="flex-1">
                        <h6 class="font-bold">${senderName}</h6>
                        <p class="text-sm opacity-90">${preview}</p>
                    </div>
                    <button onclick="this.parentElement.remove()" class="ml-2 text-lg opacity-75 hover:opacity-100">×</button>
                </div>
            `;
        }

        return toast;
    }

    /**
     * Update conversation list
     */
    updateConversationList(messages) {
        const list = document.getElementById('conversations-list');
        if (!list) return;

        messages.forEach(msg => {
            const existing = list.querySelector(`[data-conversation-id="${msg.conversation_id}"]`);
            if (existing) {
                existing.remove();
            }

            const item = document.createElement('div');
            item.className = 'conversation-item p-3 border-b cursor-pointer hover:bg-gray-50 transition';
            item.dataset.conversationId = msg.conversation_id;
            item.innerHTML = `
                <div class="flex gap-3">
                    <img src="${msg.sender.avatar_url}" alt="" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <h6 class="font-bold text-gray-900 truncate">${msg.sender.name}</h6>
                            <small class="text-gray-600">now</small>
                        </div>
                        <p class="text-sm text-gray-600 truncate">${msg.content}</p>
                    </div>
                    <span class="badge bg-indigo-600">1</span>
                </div>
            `;

            list.insertBefore(item, list.firstChild);
        });
    }

    /**
     * Update activity feed
     */
    updateActivityFeed(activities) {
        // This would update the main feed in real-time
        console.log('New activities:', activities);
    }

    handlePostCreated(payload) {
        if (!payload || !payload.post) {
            return;
        }

        this.showPostToast(payload);
        this.prependFeedPreview(payload);
        this.refreshNotifications();
    }

        handlePostShared(payload) {
            const postId = payload?.post?.id ?? payload?.post_id;
            if (!postId) {
                return;
            }

            const shareCount = payload?.post?.shares_count ?? payload?.shares_count ?? null;
            if (window.socialInteractions?.syncShareCount) {
                window.socialInteractions.syncShareCount(postId, typeof shareCount === 'number' ? shareCount : null);
            }

            const sharer = payload?.actor?.display_name ?? payload?.actor?.name ?? 'Someone';
            const summary = (payload?.post?.caption || payload?.post?.content || 'Shared a story for you.').slice(0, 200);

            this.showRealtimeToast({
                title: `${sharer} reshared a story`,
                message: summary,
                avatarUrl: payload?.actor?.avatar_url ?? '',
            });

            document.dispatchEvent(new CustomEvent('social:post:shared', { detail: { postId, payload } }));
        }

        handlePostModerated(payload) {
            const postId = payload?.post?.id ?? payload?.post_id;
            if (!postId) {
                return;
            }

            const status = payload?.status ?? payload?.post?.moderation_status ?? 'pending';
            const message = payload?.message ?? payload?.reason ?? this.describeModerationStatus(status);
            const card = document.querySelector(`[data-post-card][data-post-id="${postId}"]`);

            if (!card) {
                return;
            }

            card.dataset.moderationStatus = status;

            if (status === 'approved') {
                const overlay = card.querySelector('[data-moderation-overlay]');
                overlay?.remove();
                this.showRealtimeToast({
                    title: 'Post approved',
                    message: 'Moderators cleared a story you follow.',
                    avatarUrl: payload?.actor?.avatar_url ?? '',
                });
            } else {
                let overlay = card.querySelector('[data-moderation-overlay]');
                if (!overlay) {
                    overlay = this.buildModerationOverlay();
                    card.prepend(overlay);
                }

                const messageNode = overlay.querySelector('[data-moderation-message]');
                if (messageNode) {
                    messageNode.textContent = message;
                }

                overlay.classList.remove('is-dismissed');
                overlay.removeAttribute('aria-hidden');
            }

            document.dispatchEvent(new CustomEvent('social:post:moderated', { detail: { postId, status, message } }));
        }

        handlePostDeleted(payload) {
            const postId = payload?.post?.id ?? payload?.post_id;
            if (!postId) {
                return;
            }

            const card = document.querySelector(`[data-post-card][data-post-id="${postId}"]`);
            if (!card) {
                return;
            }

            card.classList.add('is-removed');
            setTimeout(() => card.remove(), 400);

            this.showRealtimeToast({
                title: 'Story removed',
                message: 'One of the posts in your feed is no longer available.',
                avatarUrl: payload?.actor?.avatar_url ?? '',
            });

            document.dispatchEvent(new CustomEvent('social:post:deleted', { detail: { postId } }));
        }

        handleConversationMessageCreated(payload) {
            const threadId = payload?.thread?.id;
            const message = payload?.message;

            if (!threadId || !message) {
                return;
            }

            document.dispatchEvent(new CustomEvent('messages:realtime', { detail: payload }));

            const senderName = message?.sender?.display_name
                ?? message?.sender?.username
                ?? 'New message';

            this.showMessageNotification([
                {
                    sender: {
                        avatar_url: message?.sender?.avatar_url ?? '',
                        name: senderName,
                    },
                    content: this.resolveMessagePreview(message),
                }
            ]);

            this.refreshMessages().catch(() => {});
        }

        showPostToast(payload) {
            const authorName = payload.author?.display_name ?? payload.author?.username ?? 'your network';
            const summary = (payload.post.caption || payload.post.content || 'New update').slice(0, 220);

            this.showRealtimeToast({
                title: `New story from ${authorName}`,
                message: summary,
                avatarUrl: payload.author?.avatar_url ?? '',
            });
        }

        showRealtimeToast({ title, message, avatarUrl }) {
            const container = document.getElementById('realtime-notifications') || document.body;
            const toast = document.createElement('div');
            toast.className = 'live-post-toast shadow-lg';
            toast.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="toast-avatar" style="background-image:url('${avatarUrl ?? ''}')"></div>
                    <div class="flex-1">
                        <p class="text-sm text-slate-500 mb-1">${this.escapeHtml(title ?? 'Realtime update')}</p>
                        <p class="font-semibold text-slate-900">${this.escapeHtml(message ?? '')}</p>
                    </div>
                    <button type="button" aria-label="Dismiss" class="text-slate-400 hover:text-slate-600" onclick="this.closest('.live-post-toast')?.remove()">&times;</button>
                </div>
            `;

            container.prepend(toast);
            setTimeout(() => toast.remove(), 6000);
        }

    prependFeedPreview(payload) {
        const itemsContainer = document.querySelector('#social-feed-root [data-feed-items]');
        if (!itemsContainer) {
            return;
        }

        buildModerationOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'post-moderation-overlay';
            overlay.dataset.moderationOverlay = 'true';
            overlay.innerHTML = `
                <div class="post-moderation-overlay__icon" aria-hidden="true">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="post-moderation-overlay__content">
                    <p class="post-moderation-overlay__title mb-1">Moderation in progress</p>
                    <p class="post-moderation-overlay__message" data-moderation-message></p>
                    <div class="post-moderation-overlay__actions">
                        <button type="button" class="btn btn-light btn-sm" data-moderation-dismiss aria-expanded="false">Review post anyway</button>
                    </div>
                </div>
            `;

            return overlay;
        }

        describeModerationStatus(status) {
            switch ((status || '').toLowerCase()) {
                case 'pending':
                    return 'This story is waiting for moderation before it appears to everyone.';
                case 'flagged':
                    return 'Safety systems flagged this story for review.';
                case 'rejected':
                    return 'Moderators removed this story from public view.';
                default:
                    return 'This story is temporarily hidden while moderators take a look.';
            }
        }

        const card = document.createElement('article');
        card.className = 'bg-white rounded-xl border border-indigo-100 shadow-sm animate-fade-in';

        const authorName = payload.author?.display_name || payload.author?.username || 'Member';
        const publishedAt = payload.post.published_at ? new Date(payload.post.published_at).toLocaleString() : 'Just now';
        const summary = (payload.post.caption || payload.post.content || '').slice(0, 220);

        card.innerHTML = `
            <div class="p-5">
                <div class="flex items-start gap-3">
                    <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                        ${this.buildInitials(authorName)}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between gap-2">
                            <div>
                                <p class="text-sm text-slate-500">Live update</p>
                                <h3 class="text-lg font-semibold text-slate-900">${this.escapeHtml(authorName)}</h3>
                            </div>
                            <time class="text-xs text-slate-400">${this.escapeHtml(publishedAt)}</time>
                        </div>
                        <p class="mt-3 text-slate-700 leading-relaxed">${this.escapeHtml(summary)}</p>
                    </div>
                </div>
            </div>
        `;

        itemsContainer.prepend(card);
    }

    buildInitials(name) {
        return String(name)
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join('');
    }

    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    }

    resolveMessagePreview(message) {
        if (this.isMessageRedacted(message)) {
            return this.privacyPlaceholder;
        }

        const source = message?.content ?? message?.body ?? message?.preview ?? '';
        const text = (source ?? '').toString();
        return text.length > 140 ? `${text.slice(0, 137)}...` : text;
    }

    isMessageRedacted(message) {
        return Boolean(message?.is_redacted);
    }

    /**
     * Setup push notifications
     */
    setupPushNotifications() {
        if ('Notification' in window && Notification.permission === 'granted') {
            // Push notifications already enabled
            return;
        }

        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Push notifications enabled');
                }
            });
        }
    }

    /**
     * Send push notification
     */
    sendPushNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                icon: '/images/logo.png',
                ...options
            });
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribeToUpdates(channel) {
        // This could be implemented with Laravel Echo or WebSockets
        console.log('Subscribed to channel:', channel);
    }

    /**
     * Unsubscribe from updates
     */
    unsubscribeFromUpdates(channel) {
        console.log('Unsubscribed from channel:', channel);
    }

    /**
     * Update like count in real-time
     */
    updateLikeCount(postId, newCount) {
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            const likeSpan = card.querySelector('.post-stats span:first-child');
            if (likeSpan) {
                likeSpan.innerHTML = `<i class="fas fa-thumbs-up mr-1 text-blue-500"></i>${newCount} Likes`;
            }
        }
    }

    /**
     * Update comment count in real-time
     */
    updateCommentCount(postId, newCount) {
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            const commentSpan = card.querySelector('.post-stats span:nth-child(2)');
            if (commentSpan) {
                commentSpan.innerHTML = `<i class="fas fa-comment mr-1 text-green-500"></i>${newCount} Comments`;
            }
        }
    }

    /**
     * Refresh notifications
     */
    async refreshNotifications() {
        await this.checkForNewNotifications();
    }

    /**
     * Refresh messages
     */
    async refreshMessages() {
        await this.checkForNewMessages();
    }
}

// Initialize real-time updates
const realtimeUpdates = new RealTimeUpdates();
window.realtimeUpdates = realtimeUpdates;

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .live-post-toast {
        background: #fff;
        border-radius: 0.75rem;
        padding: 1rem;
        border: 1px solid rgba(99, 102, 241, 0.25);
        margin-bottom: 0.75rem;
        min-width: 280px;
    }

    .live-post-toast .toast-avatar {
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        background-color: #eef2ff;
        background-size: cover;
        background-position: center;
    }

    .animate-fade-in {
        animation: fadeInUp 0.45s ease;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .post-card.is-removed {
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.25s ease, transform 0.25s ease;
    }
`;
document.head.appendChild(style);
