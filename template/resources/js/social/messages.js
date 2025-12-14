/**
 * Messages Module
 * Handles messaging and real-time chat
 */

const MessagesModule = {
    currentConversationId: null,
    messagePollingInterval: null,
    realtimeActive: false,
    privacyPlaceholder: 'Message hidden for privacy.',

    init() {
        this.setupEventListeners();
        this.registerReportContext();
        this.setupRealtimeBridge();
    },

    setupEventListeners() {
        document.addEventListener('click', (event) => {
            const item = event.target.closest('.conversation-item');

            if (item) {
                const convId = item.dataset.conversationId;
                this.openConversation(convId);
            }
        });

        const form = document.querySelector('form[onsubmit*="sendMessage"]');
        if (form) {
            form.addEventListener('submit', (event) => this.handleSendMessage(event));
        }

        const searchInput = document.getElementById('conversationSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => this.searchConversations(event.target.value));
        }
    },

    setupRealtimeBridge() {
        this.realtimeActive = this.supportsRealtime();

        if (this.realtimeActive) {
            document.addEventListener('messages:realtime', (event) => {
                this.handleRealtimeMessage(event.detail);
            });
        } else {
            this.startMessagePolling();
        }

        document.addEventListener('realtime:fallback', () => {
            if (!this.messagePollingInterval) {
                this.startMessagePolling();
            }
        });
    },

    supportsRealtime() {
        return typeof window.Echo !== 'undefined' && Number.isInteger(window.currentUserId);
    },

    async openConversation(conversationId) {
        if (!conversationId) {
            return;
        }

        this.currentConversationId = conversationId;
        this.registerReportContext();

        try {
              const response = await fetch(`/member/messages/${conversationId}`, {
                headers: { 'X-CSRF-TOKEN': this.getCsrfToken() },
            });
            const data = await response.json();
            const otherUser = data && data.otherUser ? data.otherUser : {};

            const emptyState = document.getElementById('no-conversation');
            const chatContainer = document.getElementById('chat-container');

            if (emptyState && chatContainer) {
                emptyState.style.display = 'none';
                chatContainer.style.display = 'flex';
            }

            const conversationField = document.getElementById('conversation-id');
            if (conversationField) {
                conversationField.value = conversationId;
            }

            const nameEl = document.getElementById('chat-user-name');
            const avatarEl = document.getElementById('chat-user-avatar');

            if (nameEl) {
                nameEl.textContent = otherUser.name || 'Conversation';
            }

            if (avatarEl && otherUser.avatar_url) {
                avatarEl.src = otherUser.avatar_url;
            }

            this.registerReportContext({
                subjectUserId: otherUser.id || null,
                metadata: {
                    subject_user_id: otherUser.id || null,
                    other_user_name: otherUser.name || null,
                    thread_type: data.thread_type || 'direct_message',
                },
            });

            this.displayMessages(data.messages || []);
            this.registerReportContext();

            await fetch(`/member/messages/${conversationId}/mark-as-read`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': this.getCsrfToken() },
            });

            if (window.realtimeUpdates && typeof window.realtimeUpdates.checkForNewMessages === 'function') {
                window.realtimeUpdates.checkForNewMessages();
            }
        } catch (error) {
            console.error('Error opening conversation:', error);
        }
    },

    displayMessages(messages) {
        const container = document.getElementById('messages-container');
        if (!container) {
            return;
        }

        container.innerHTML = (messages || []).map((msg) => this.buildMessageHtml(msg)).join('');

        container.scrollTop = container.scrollHeight;
    },

    async handleSendMessage(event) {
        event.preventDefault();

        const conversationField = document.getElementById('conversation-id');
        const input = document.getElementById('message-input');

        if (!conversationField || !input) {
            return;
        }

        const conversationId = conversationField.value;
        const content = input.value.trim();

        if (!content) {
            return;
        }

        try {
                const response = await fetch(`/member/messages/${conversationId}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': this.getCsrfToken(),
                },
                body: JSON.stringify({ content }),
            });

            if (response.ok) {
                input.value = '';
                this.openConversation(conversationId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    },

    async searchConversations(query) {
        if (!query || query.length < 2) {
            window.location.reload();
            return;
        }

        try {
             const response = await fetch(`/member/messages/search?q=${encodeURIComponent(query)}`, {
                headers: { 'X-CSRF-TOKEN': this.getCsrfToken() },
            });
            const results = await response.json();
            this.displayConversationsList(results || []);
        } catch (error) {
            console.error('Search error:', error);
        }
    },

    displayConversationsList(conversations) {
        const list = document.getElementById('conversations-list');
        if (!list) {
            return;
        }

        list.innerHTML = (conversations || []).map((conv) => {
            const otherUser = conv && conv.otherUser ? conv.otherUser : {};
            const avatar = otherUser.avatar_url || 'https://via.placeholder.com/64';
            const name = otherUser.name || 'Connection';
            const lastMessage = this.resolveThreadPreview(conv?.last_message);
            const unreadCount = typeof conv.unread_count !== 'undefined' ? conv.unread_count : 0;

            return `
            <div class="conversation-item p-3 border-b cursor-pointer hover:bg-gray-50 transition"
                 data-conversation-id="${conv.id}"
                 onclick="MessagesModule.openConversation(${conv.id})">
                <div class="flex gap-3">
                    <img src="${avatar}" alt="${name}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <h6 class="font-bold text-gray-900 truncate">${name}</h6>
                            <small class="text-gray-600">${this.formatTime(conv.last_message_at)}</small>
                        </div>
                        <p class="text-sm text-gray-600 truncate">${lastMessage}</p>
                    </div>
                    ${unreadCount > 0 ? `<span class="badge bg-indigo-600">${unreadCount}</span>` : ''}
                </div>
            </div>
        `;
        }).join('');
    },

    startMessagePolling() {
        if (this.messagePollingInterval) {
            return;
        }

        this.messagePollingInterval = setInterval(async () => {
            if (!this.currentConversationId) {
                return;
            }

            try {
                 const response = await fetch(`/member/messages/${this.currentConversationId}`, {
                    headers: { 'X-CSRF-TOKEN': this.getCsrfToken() },
                });
                const data = await response.json();
                this.displayMessages(data.messages || []);
            } catch (error) {
                console.error('Error polling messages:', error);
            }
        }, 3000);
    },

    stopMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
            this.messagePollingInterval = null;
        }
    },

    handleRealtimeMessage(payload) {
        if (!payload || !payload.thread || !payload.message) {
            return;
        }

        const conversationId = String(payload.thread.id);
        const normalizedMessage = this.normalizeRealtimeMessage(payload.message);
        const isCurrent = String(this.currentConversationId) === conversationId;

        if (isCurrent) {
            this.appendMessage(normalizedMessage);
            this.markConversationAsRead(conversationId);
        } else {
            this.bumpConversationPreview(conversationId, normalizedMessage);
        }
    },

    normalizeRealtimeMessage(message) {
        const sentAt = message.sent_at ?? message.created_at ?? new Date().toISOString();
        const isRedacted = Boolean(message?.is_redacted);
        const body = isRedacted ? '' : (message.body ?? message.content ?? '');

        return {
            ...message,
            is_redacted: isRedacted,
            sender_id: message.sender_id ?? message?.sender?.id ?? null,
            content: body,
            body,
            created_at: sentAt,
        };
    },

    appendMessage(message) {
        const container = document.getElementById('messages-container');
        if (!container) {
            return;
        }

        container.insertAdjacentHTML('beforeend', this.buildMessageHtml(message));
        container.scrollTop = container.scrollHeight;
    },

    buildMessageHtml(message) {
        const senderId = Number(message.sender_id ?? message?.sender?.id);
        const isOwn = senderId === Number(window.currentUserId);
        const preview = encodeURIComponent(this.previewMessage(message));
        const body = this.renderMessageBody(message);
        const metadataPayload = encodeURIComponent(JSON.stringify({
            message_id: message.id,
            conversation_id: this.currentConversationId,
            sender_id: senderId,
            sent_at: message.created_at,
        }));
        const actionButton = isOwn ? '' : `
                <button type="button"
                    class="message-action"
                    aria-label="Message actions"
                    data-message-id="${message.id}"
                    data-message-preview="${preview}"
                    data-report-metadata="${metadataPayload}"
                    data-subject-user-id="${senderId || ''}">
                    <i class="fas fa-flag"></i>
                </button>`;

        return `
            <div class="message ${isOwn ? 'sent' : 'received'} flex ${isOwn ? 'justify-end' : 'justify-start'}">
                <div class="message-bubble ${isOwn ? 'sent' : 'received'}">
                    <div class="message-body">
                        <p>${body}</p>
                        <small class="opacity-75">${this.formatTime(message.created_at)}</small>
                    </div>
                    ${actionButton}
                </div>
            </div>
        `;
    },

    bumpConversationPreview(conversationId, message) {
        const list = document.getElementById('conversations-list');
        if (!list) {
            return;
        }

        const item = list.querySelector(`[data-conversation-id="${conversationId}"]`);

        if (!item) {
            if (window.realtimeUpdates && typeof window.realtimeUpdates.refreshMessages === 'function') {
                window.realtimeUpdates.refreshMessages();
            }
            return;
        }

        const previewEl = item.querySelector('p.text-sm');
        if (previewEl) {
            previewEl.textContent = this.previewMessage(message);
        }

        const timeEl = item.querySelector('small.text-gray-600');
        if (timeEl) {
            timeEl.textContent = this.formatTime(message.created_at);
        }

        if (String(this.currentConversationId) !== String(conversationId)) {
            this.incrementConversationBadge(item);
        }
    },

    incrementConversationBadge(item) {
        const wrapper = item.querySelector('.flex.gap-3') || item;
        let badge = item.querySelector('.badge');

        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge bg-indigo-600';
            wrapper.appendChild(badge);
        }

        const nextCount = (parseInt(badge.textContent || '0', 10) || 0) + 1;
        badge.textContent = nextCount;
        badge.style.display = 'inline-block';
    },

    formatTime(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return d.toLocaleDateString();
    },

    previewMessage(message) {
        if (this.isMessageRedacted(message)) {
            return this.privacyPlaceholder;
        }

        const source = message ? (message.content ?? message.body) : '';
        const raw = (source ?? '').toString();
        return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
    },

    renderMessageBody(message) {
        if (this.isMessageRedacted(message)) {
            return this.privacyPlaceholder;
        }

        return ((message && (message.content ?? message.body)) ?? '').toString();
    },

    resolveThreadPreview(payload) {
        if (!payload) {
            return '';
        }

        if (this.isMessageRedacted(payload)) {
            return this.privacyPlaceholder;
        }

        if (typeof payload === 'string') {
            return payload;
        }

        if (typeof payload === 'object') {
            const body = payload.body ?? payload.content ?? payload?.metadata?.preview ?? '';
            return body ? body.toString() : '';
        }

        return '';
    },

    isMessageRedacted(payload) {
        if (!payload) {
            return false;
        }

        if (typeof payload === 'object') {
            return Boolean(payload.is_redacted);
        }

        return false;
    },

    registerReportContext(extra = {}) {
        if (!window.MessageReportActions) {
            return;
        }

        window.MessageReportActions.init();
        const metadata = {
            conversation_id: this.currentConversationId,
            ...(extra.metadata || {}),
        };

        window.MessageReportActions.setContext({
            source: 'frontend.messages',
            conversationId: this.currentConversationId,
            ...extra,
            metadata,
        });
    },

    async markConversationAsRead(conversationId) {
        try {
             await fetch(`/member/messages/${conversationId}/mark-as-read`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': this.getCsrfToken() },
            });
        } catch (error) {
            console.error('Error marking conversation as read:', error);
        }
    },

    getCsrfToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        return token ? token.content : '';
    },
};

window.MessagesModule = MessagesModule;

const userMeta = document.querySelector('meta[name="user-id"]');
window.currentUserId = parseInt(userMeta ? userMeta.content : 0, 10);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MessagesModule.init());
} else {
    MessagesModule.init();
}
