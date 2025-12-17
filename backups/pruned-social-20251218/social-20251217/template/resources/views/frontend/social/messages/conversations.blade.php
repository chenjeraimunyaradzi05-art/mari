@extends('frontend.social.layout')

@section('social-content')
<div class="space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white shadow-lg">
        <div class="flex items-center gap-4">
            <img src="{{ asset('default-uploads/logo.png') }}" alt="Logo" class="h-12 opacity-90">
            <div>
                <h1 class="text-3xl font-bold">Messaging</h1>
                <p class="text-indigo-100 mt-1">Connect and collaborate with professionals</p>
            </div>
        </div>
    </div>

    <!-- Messages Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Conversation List -->
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
            <div class="p-4 border-b border-gray-200">
                <input type="text" class="form-control rounded-lg" id="conversationSearch" placeholder="Search conversations...">
            </div>
            <div class="divide-y max-h-96 overflow-y-auto">
                @for ($i = 1; $i <= 5; $i++)
                <div class="p-4 hover:bg-indigo-50 cursor-pointer transition border-l-4 {{ $i === 1 ? 'border-indigo-600 bg-indigo-50' : 'border-transparent' }}">
                    <div class="flex items-center gap-3">
                        <img src="{{ asset('images/default-avatar.png') }}" alt="" class="w-10 h-10 rounded-full">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-900 truncate">Contact {{ $i }}</p>
                            <p class="text-sm text-gray-600 truncate">Last message preview...</p>
                        </div>
                        <span class="text-xs text-gray-500">{{ $i }}h</span>
                    </div>
                </div>
                @endfor
            </div>
        </div>

        <!-- Chat Area -->
        <div class="md:col-span-2 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
            <!-- Chat Header -->
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src="{{ asset('images/default-avatar.png') }}" alt="" class="w-10 h-10 rounded-full">
                    <div>
                        <h3 class="font-bold text-gray-900">Contact Name</h3>
                        <p class="text-sm text-green-600">Online</p>
                    </div>
                </div>
                <button class="text-gray-500 hover:text-gray-700"><i class="fas fa-info-circle"></i></button>
            </div>

            <!-- Messages -->
            <div class="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
                <!-- Received Message -->
                <div class="flex gap-3">
                    <img src="{{ asset('images/default-avatar.png') }}" alt="" class="w-8 h-8 rounded-full">
                    <div class="bg-white rounded-lg p-3 max-w-xs shadow-sm message-bubble received">
                        <div class="message-body">
                            <p class="text-sm text-gray-900">Hey! How are you doing?</p>
                            <p class="text-xs text-gray-500 mt-1">10:30 AM</p>
                        </div>
                        <button type="button" class="message-action"
                            data-message-id=""
                            data-message-preview="{{ rawurlencode('Hey! How are you doing?') }}"
                            data-report-metadata="{{ rawurlencode(json_encode(['message_id' => 0, 'conversation_id' => 0, 'sender_id' => 0])) }}"
                            data-subject-user-id="0"
                            aria-label="Report message">
                            <i class="fas fa-flag"></i>
                        </button>
                    </div>
                </div>

                <!-- Sent Message -->
                <div class="flex justify-end gap-3">
                    <div class="bg-indigo-600 text-white rounded-lg p-3 max-w-xs shadow-sm message-bubble sent">
                        <div class="message-body">
                            <p class="text-sm">Doing great! Let's catch up soon</p>
                            <p class="text-xs text-indigo-100 mt-1">10:32 AM</p>
                        </div>
                    </div>
                </div>

                <!-- AI Suggestion -->
                <div class="flex justify-center py-2">
                    <div class="bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                        <p class="text-xs text-indigo-700"><i class="fas fa-sparkles mr-1"></i>Suggested reply ready</p>
                    </div>
                </div>
            </div>

            <!-- Input Area -->
            <div class="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
                <!-- AI Suggestions -->
                <div class="flex gap-2 flex-wrap">
                    <button class="text-xs px-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-indigo-50 hover:border-indigo-300 transition">
                        That sounds great!
                    </button>
                    <button class="text-xs px-3 py-1 bg-white border border-gray-200 rounded-full hover:bg-purple-50 hover:border-purple-300 transition">
                        Let's schedule it
                    </button>
                </div>
                <div class="flex gap-2">
                    <input type="text" class="form-control rounded-lg" placeholder="Type a message...">
                    <button class="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 transition">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

@include('frontend.social.messages.partials.report-modal')



@push('scripts')
@vite(['resources/js/social/message-reporting.js', 'resources/js/social/messages.js'])
@endpush
@endsection

