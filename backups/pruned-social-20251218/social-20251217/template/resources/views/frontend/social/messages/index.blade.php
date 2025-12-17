@extends('frontend.social.layout')

@section('social-content')
@php
    $memberLabel = member_label();
    $membersLabel = member_label('members');
    $previewPlaceholder = 'Message hidden for privacy.';
    $formatMessagePreview = static function ($payload, string $fallback = '', int $limit = 110) use ($previewPlaceholder) {
        $isRedacted = false;
        $body = null;

        if (is_array($payload) || $payload instanceof \ArrayAccess) {
            $isRedacted = (bool) data_get($payload, 'is_redacted', false);
            $body = data_get($payload, 'body')
                ?? data_get($payload, 'content')
                ?? data_get($payload, 'metadata.preview');
        } elseif (is_object($payload)) {
            $isRedacted = (bool) ($payload->is_redacted ?? false);
            $body = $payload->body
                ?? $payload->content
                ?? data_get($payload, 'metadata.preview');
        } elseif (is_string($payload)) {
            $body = $payload;
        }

        if ($isRedacted) {
            return $previewPlaceholder;
        }

        if (is_string($body) && $body !== '') {
            return \Illuminate\Support\Str::limit(strip_tags($body), $limit);
        }

        return $fallback;
    };
@endphp
<div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-3xl font-bold text-gray-900">Messages</h2>
            <p class="text-gray-600 mt-1">Chat privately with fellow {{ strtolower($membersLabel) }}</p>
        </div>
        <button class="btn btn-gradient" data-bs-toggle="modal" data-bs-target="#newMessageModal">
            <i class="fas fa-plus mr-2"></i>New Message
        </button>
    </div>

    <!-- Messages Container -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Conversations List -->
        <div class="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
            <!-- Search -->
            <div class="p-4 border-b">
                <div class="relative">
                    <input type="text" class="form-control" id="conversationSearch"
                           placeholder="Search conversations..." onkeyup="searchConversations()">
                    <i class="fas fa-search absolute right-3 top-3 text-gray-400"></i>
                </div>
            </div>

            <!-- Conversations List -->
            <div class="overflow-y-auto flex-1" style="max-height: 500px;" id="conversations-list">
                @forelse($conversations ?? [] as $conversation)
                    @php
                        $conversationData = is_array($conversation)
                            ? $conversation
                            : ((is_object($conversation) && method_exists($conversation, 'toArray'))
                                ? $conversation->toArray()
                                : []);
                        $conversationId = data_get($conversationData, 'id');
                        $otherParticipant = data_get($conversationData, 'otherUser');
                        $otherName = data_get($otherParticipant, 'name', __('Connection'));
                        $otherAvatar = data_get($otherParticipant, 'avatar_url') ?: 'https://via.placeholder.com/40';
                        $lastMessagePayload = data_get($conversationData, 'last_message');
                        if (! $lastMessagePayload) {
                            $lastMessagePayload = data_get($conversationData, 'body')
                                ?? data_get($conversationData, 'message');
                        }
                        $lastMessageAt = data_get($conversationData, 'last_message_at');
                        $lastMessageHuman = $lastMessageAt instanceof \Carbon\CarbonInterface
                            ? $lastMessageAt->diffForHumans()
                            : (is_string($lastMessageAt) ? $lastMessageAt : '');
                        $unreadCount = (int) data_get($conversation, 'unread_count', 0);
                        $lastMessagePreview = $formatMessagePreview(
                            $lastMessagePayload,
                            "Open the thread to see what's new.",
                            110
                        );
                    @endphp
                    <div class="conversation-item p-3 border-b cursor-pointer hover:bg-gray-50 transition"
                         data-conversation-id="{{ $conversationId }}"
                         onclick="openConversation({{ $conversationId ?? 'null' }})">
                        <div class="flex gap-3">
                            <img src="{{ $otherAvatar }}"
                                 alt="{{ $otherName }}" class="w-10 h-10 rounded-full object-cover">
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <h6 class="font-bold text-gray-900 truncate">{{ $otherName }}</h6>
                                    <small class="text-gray-600 ml-2 flex-shrink-0">
                                        {{ $lastMessageHuman }}
                                    </small>
                                </div>
                                <p class="text-sm text-gray-600 truncate">{{ $lastMessagePreview }}</p>
                            </div>
                            @if($unreadCount > 0)
                                <span class="badge bg-indigo-600">{{ $unreadCount }}</span>
                            @endif
                        </div>
                    </div>
                @empty
                    <div class="p-6 text-center text-gray-500">
                        <i class="fas fa-inbox text-3xl text-gray-300 mb-3"></i>
                        <p>No {{ strtolower($memberLabel) }} conversations yet</p>
                    </div>
                @endforelse
            </div>
        </div>

        <!-- Chat Area -->
        <div class="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
            <div id="no-conversation" class="flex-1 flex items-center justify-center text-gray-500">
                <div class="text-center">
                    <i class="fas fa-comments text-4xl text-gray-300 mb-4"></i>
                    <p>Select a {{ strtolower($memberLabel) }} to start messaging</p>
                </div>
            </div>

            <div id="chat-container" style="display: none;" class="flex flex-col h-full">
                <!-- Chat Header -->
                <div class="p-4 border-b flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img id="chat-user-avatar" src="" alt="" class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <h6 class="font-bold text-gray-900" id="chat-user-name"></h6>
                            <small class="text-gray-600" id="chat-user-status">
                                <i class="fas fa-circle text-green-500 mr-1"></i>Online
                            </small>
                        </div>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-light" data-bs-toggle="dropdown">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#"><i class="fas fa-info-circle mr-2"></i>View Profile</a></li>
                            <li><a class="dropdown-item" href="#"><i class="fas fa-bell-slash mr-2"></i>Mute Notifications</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#"><i class="fas fa-trash mr-2"></i>Delete Chat</a></li>
                        </ul>
                    </div>
                </div>

                <!-- Messages -->
                <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" id="messages-container">
                    <!-- Populated by AJAX -->
                </div>

                <!-- Message Input -->
                <div class="p-4 bg-white border-t">
                    <form onsubmit="sendMessage(event)" class="flex gap-3">
                        <input type="hidden" id="conversation-id">
                        <div class="flex-1">
                            <textarea class="form-control" id="message-input" rows="2"
                                     placeholder="Type a message..." required></textarea>
                        </div>
                        <div class="flex gap-2 flex-column">
                            <button type="button" class="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#aiSuggestionsModal">
                                <i class="fas fa-magic"></i>
                            </button>
                            <button type="submit" class="btn btn-gradient">
                                <i class="fas fa-paper-plane"></i>Send
                            </button>
                        </div>
                    </form>

                    <!-- Quick Reactions -->
                    <div class="mt-3 flex gap-2 flex-wrap">
                        <button class="quick-reaction-btn" data-reaction="👍">👍</button>
                        <button class="quick-reaction-btn" data-reaction="❤️">❤️</button>
                        <button class="quick-reaction-btn" data-reaction="😂">😂</button>
                        <button class="quick-reaction-btn" data-reaction="🎉">🎉</button>
                        <button class="quick-reaction-btn" data-reaction="🔥">🔥</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- New Message Modal -->
<div class="modal fade" id="newMessageModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <h5 class="modal-title"><i class="fas fa-envelope mr-2"></i>New Message</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label">Select recipient</label>
                    <select class="form-control" id="recipientSelect" onchange="selectRecipient()">
                        <option value="">Choose a connection...</option>
                        @foreach($connections ?? [] as $connection)
                            @php
                                $connectedUser = data_get($connection, 'connectedUser');
                                $connectedId = data_get($connectedUser, 'id');
                                $connectedName = data_get($connectedUser, 'name', __('Connection'));
                            @endphp
                            <option value="{{ $connectedId }}">
                                {{ $connectedName }}
                            </option>
                        @endforeach
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Message</label>
                    <textarea class="form-control" id="initialMessage" rows="4" placeholder="Type your message..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-gradient" onclick="startConversation()">
                    <i class="fas fa-paper-plane mr-2"></i>Send Message
                </button>
            </div>
        </div>
    </div>
</div>

<!-- AI Suggestions Modal -->
<div class="modal fade" id="aiSuggestionsModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <h5 class="modal-title"><i class="fas fa-magic mr-2"></i>AI Message Suggestions</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label">Message Context</label>
                    <select class="form-control" id="messageContext">
                        <option value="">Select context...</option>
                        <option value="greeting">Greeting</option>
                        <option value="professional">Professional Inquiry</option>
                        <option value="follow-up">Follow-up</option>
                        <option value="networking">Networking</option>
                        <option value="job-related">Job Related</option>
                    </select>
                </div>
                <button class="btn btn-gradient w-100 mb-3" onclick="generateMessageSuggestions()">
                    <i class="fas fa-sparkles mr-2"></i>Generate Suggestions
                </button>

                <div id="suggestions" style="display: none;">
                    <h6 class="mb-3">Suggested Messages:</h6>
                    <div class="space-y-2" id="suggestions-list"></div>
                </div>
            </div>
        </div>
    </div>
</div>

@include('frontend.social.messages.partials.report-modal')



@push('scripts')
@vite(['resources/js/social/message-reporting.js', 'resources/js/social/messages.js'])
<script>
function openConversation(conversationId) {
    fetch(`/member/messages/${conversationId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('conversation-id').value = conversationId;
            document.getElementById('chat-user-name').textContent = data.otherUser.name;
            document.getElementById('chat-user-avatar').src = data.otherUser.avatar_url;
            document.getElementById('no-conversation').style.display = 'none';
            document.getElementById('chat-container').style.display = 'flex';
            renderMessages(data.messages);

            if (window.MessageReportActions) {
                window.MessageReportActions.setContext({
                    source: 'frontend.messages',
                    conversationId,
                    subjectUserId: data?.otherUser?.id || null,
                    metadata: {
                        conversation_id: conversationId,
                        subject_user_id: data?.otherUser?.id || null,
                        other_user_name: data?.otherUser?.name || null,
                    },
                });
            }

            // Mark as read
            fetch(`/member/messages/${conversationId}/mark-as-read`, {
                method: 'POST',
                headers: {'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content}
            });
        });
}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    const conversationId = document.getElementById('conversation-id')?.value;
    container.innerHTML = messages.map(msg => {
        const isOwn = msg.sender_id === {{ auth()->id() }};
        const preview = encodeURIComponent(((msg.content ?? msg.body ?? '') + '').slice(0, 140));
        const avatar = msg.sender && msg.sender.avatar_url ? msg.sender.avatar_url : 'https://via.placeholder.com/40';
        const metadataPayload = encodeURIComponent(JSON.stringify({
            message_id: msg.id,
            conversation_id: conversationId,
            sender_id: msg.sender_id,
            sent_at: msg.created_at,
        }));

        return `
        <div class="message ${isOwn ? 'sent' : 'received'} flex gap-2">
            ${!isOwn ? `<img src="${avatar}" class="w-8 h-8 rounded-full">` : ''}
            <div class="message-bubble ${isOwn ? 'sent' : 'received'}">
                <div class="message-body">
                    <p>${msg.content}</p>
                    <small class="opacity-75">${new Date(msg.created_at).toLocaleTimeString()}</small>
                </div>
                ${!isOwn ? `
                <button type="button" class="message-action" data-message-id="${msg.id}" data-message-preview="${preview}" data-report-metadata="${metadataPayload}" data-subject-user-id="${msg.sender_id}" aria-label="Message actions">
                    <i class="fas fa-flag"></i>
                </button>` : ''}
            </div>
        </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function sendMessage(e) {
    e.preventDefault();
    const conversationId = document.getElementById('conversation-id').value;
    const content = document.getElementById('message-input').value;

    fetch(`/member/messages/${conversationId}/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ content })
    }).then(() => {
        document.getElementById('message-input').value = '';
        openConversation(conversationId); // Refresh messages
    });
}

function generateMessageSuggestions() {
    const context = document.getElementById('messageContext').value;
    if (!context) {
        alert('Please select a context');
        return;
    }

    fetch('/member/messages/ai-suggestions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ context })
    })
    .then(response => response.json())
    .then(data => {
        const html = data.suggestions.map((sugg, idx) => `
            <div class="p-3 bg-gray-100 rounded cursor-pointer hover:bg-indigo-100"
                 onclick="useSuggestion(\`${sugg.replace(/`/g, '\\`')}\`)">
                <p class="text-sm">${sugg}</p>
            </div>
        `).join('');
        document.getElementById('suggestions-list').innerHTML = html;
        document.getElementById('suggestions').style.display = 'block';
    });
}

function useSuggestion(text) {
    document.getElementById('message-input').value = text;
    bootstrap.Modal.getInstance(document.getElementById('aiSuggestionsModal')).hide();
}

document.querySelectorAll('.quick-reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('message-input').value += btn.dataset.reaction + ' ';
        document.getElementById('message-input').focus();
    });
});
</script>
@endpush
@endsection

