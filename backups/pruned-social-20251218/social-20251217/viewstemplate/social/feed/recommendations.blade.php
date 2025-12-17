@extends('frontend.layouts.master')

@section('title', 'Suggested Connections')

@section('content')
<div id="social-recommendations-root" class="min-h-screen bg-gray-50 pb-12 pt-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

            <!-- Main Content -->
            <div class="lg:col-span-8 space-y-6">

                <!-- Header -->
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2 px-2">
                    <div>
                        <p class="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Network Growth</p>
                        <h1 class="text-2xl font-bold text-gray-900">People you should know</h1>
                        <p class="text-gray-500 text-sm">Curated matches based on your industry, interests, and mutual connections.</p>
                    </div>
                    <a href="{{ route('social.feed.index') }}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 hover:text-rose-600 transition-colors shadow-sm">
                        <i class="fas fa-arrow-left"></i>
                        Back to feed
                    </a>
                </div>

                <!-- Recommendations Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    @forelse($suggestions as $suggestion)
                        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-rose-50 to-transparent opacity-50"></div>

                            <div class="relative mb-4">
                                <img src="{{ $suggestion['avatar_url'] }}" alt="{{ $suggestion['display_name'] }}" class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-sm">
                                @if(!empty($suggestion['reason']))
                                    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-100 shadow-sm whitespace-nowrap">
                                        <p class="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                            <i class="fas fa-sparkles"></i> {{ $suggestion['reason'] }}
                                        </p>
                                    </div>
                                @endif
                            </div>

                            <h3 class="text-lg font-bold text-gray-900 mb-1">
                                <a href="{{ $suggestion['profile_url'] }}" class="hover:text-rose-600 transition-colors">{{ $suggestion['display_name'] }}</a>
                            </h3>
                            <p class="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5em]">{{ $suggestion['headline'] }}</p>

                            <button
                                type="button"
                                class="w-full py-2 rounded-xl font-bold text-sm transition-all transform active:scale-95 {{ $suggestion['is_following'] ? 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm hover:shadow-md' }}"
                                data-follow-button
                                data-username="{{ $suggestion['username'] }}"
                                data-following="{{ $suggestion['is_following'] ? 'true' : 'false' }}"
                            >
                                {{ $suggestion['is_following'] ? 'Following' : 'Connect' }}
                            </button>
                        </div>
                    @empty
                        <div class="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                            <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-user-friends text-gray-400 text-2xl"></i>
                            </div>
                            <h3 class="text-lg font-bold text-gray-900 mb-2">No recommendations yet</h3>
                            <p class="text-gray-500">Engage with more posts to help us find your people.</p>
                        </div>
                    @endforelse
                </div>
            </div>

            <!-- Right Sidebar -->
            <aside class="lg:col-span-4 space-y-6">
                <!-- Advertising & Partnership -->
                <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm p-6 border border-amber-100 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-2xl -mr-10 -mt-10 opacity-60"></div>
                    <div class="relative z-10">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <p class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Brand Partnership</p>
                                <h3 class="text-lg font-bold text-gray-900">Advertising & Promotions</h3>
                            </div>
                            <span class="bg-white/80 px-2 py-1 rounded-lg text-xs font-bold text-amber-600 border border-amber-100 shadow-sm">Ad</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4">Explore exclusive opportunities from our trusted partners. Connect with brands that align with your values and growth.</p>
                        <button type="button" class="w-full py-2.5 bg-white text-amber-800 text-sm font-bold rounded-xl border border-amber-200 hover:bg-amber-50 transition-all shadow-sm hover:shadow-md">
                            View Opportunities
                        </button>
                    </div>
                </div>

                <!-- Quick Tips -->
                <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h4 class="font-bold text-gray-900 mb-4">Networking Tips</h4>
                    <ul class="space-y-4">
                        <li class="flex gap-3">
                            <div class="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                                <i class="fas fa-comment-alt text-xs"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-900">Start a conversation</p>
                                <p class="text-xs text-gray-500">Don't just follow—reply to a post to break the ice.</p>
                            </div>
                        </li>
                        <li class="flex gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                <i class="fas fa-user-edit text-xs"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-900">Complete your profile</p>
                                <p class="text-xs text-gray-500">Members with photos and bios get 4x more connections.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </aside>
        </div>
    </div>
</div>

@push('scripts')
<script>
    // Re-use the follow button logic from the main feed
    document.querySelectorAll('[data-follow-button]').forEach((button) => {
        button.addEventListener('click', () => {
            const following = button.dataset.following === 'true';
            button.dataset.following = following ? 'false' : 'true';

            if (following) {
                button.classList.remove('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'shadow-sm', 'hover:shadow-md');
                button.classList.add('bg-gray-50', 'text-gray-500', 'border', 'border-gray-200', 'hover:bg-gray-100');
                button.textContent = 'Connect';
            } else {
                button.classList.remove('bg-gray-50', 'text-gray-500', 'border', 'border-gray-200', 'hover:bg-gray-100');
                button.classList.add('bg-rose-600', 'text-white', 'hover:bg-rose-700', 'shadow-sm', 'hover:shadow-md');
                button.textContent = 'Following';
            }

            // Optional: Toast notification if available
            if (window.socialInteractions && window.socialInteractions.showToast) {
                window.socialInteractions.showToast({
                    message: following ? 'Connection removed' : 'Connection request sent',
                    type: following ? 'warning' : 'success'
                });
            }
        });
    });
</script>
@endpush
@endsection
