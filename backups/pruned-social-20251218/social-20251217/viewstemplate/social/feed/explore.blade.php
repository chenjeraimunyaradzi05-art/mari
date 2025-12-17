@extends('frontend.layouts.master')

@section('title', 'Explore the Community')

@section('content')
<div id="social-explore-root" class="min-h-screen bg-gray-50 pb-12 pt-20" data-feed-wrapper>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

            <!-- Main Feed Column -->
            <div class="lg:col-span-8 space-y-6">

                <!-- Short Videos -->
                @if(($shortVideos ?? collect())->isNotEmpty())
                    @include('social.feed.partials.short-videos', ['videos' => $shortVideos])
                @endif

                <!-- Header -->
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2 px-2">
                    <div>
                        <p class="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Explore</p>
                        <h1 class="text-2xl font-bold text-gray-900">Trending stories curated for growth</h1>
                        <p class="text-gray-500 text-sm">Human editors and the feed engine surface inspiring wins, roles, and resources.</p>
                    </div>
                    <a href="{{ route('social.feed.index') }}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 hover:text-rose-600 transition-colors shadow-sm">
                        <i class="fas fa-arrow-left"></i>
                        Back to feed
                    </a>
                </div>

                <!-- Posts Container -->
                <div id="posts-container" class="space-y-6">
                    @if(($trendingPosts ?? collect())->isNotEmpty())
                        @include('social.feed.partials.posts', ['posts' => $trendingPosts])
                    @else
                        <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
                            <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-stream text-gray-400 text-2xl"></i>
                            </div>
                            <h3 class="text-lg font-bold text-gray-900 mb-2">No trending posts yet</h3>
                            <p class="text-gray-500">Check back soon—editorial pins refresh hourly.</p>
                        </div>
                    @endif
                </div>

                <!-- Entertainment Feed -->
                @if(($entertainment ?? collect())->isNotEmpty())
                    <div class="mt-12 mb-6">
                        <div class="flex items-center justify-between mb-4 px-2">
                            <div>
                                <p class="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Entertainment Hub</p>
                                <h2 class="text-xl font-bold text-gray-900">Movies, Docs & Learning</h2>
                            </div>
                            <a href="#" class="text-sm font-bold text-indigo-600 hover:text-indigo-700">Browse Hub</a>
                        </div>
                        <div class="space-y-6">
                            @include('social.feed.partials.posts', ['posts' => $entertainment])
                        </div>
                    </div>
                @endif
            </div>

            <!-- Right Sidebar -->
            <aside class="lg:col-span-4 space-y-6">

                <!-- Trending -->
                @php($trendList = collect($trendCounters ?? []))
                @if($trendList->isNotEmpty())
                    <div class="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <small class="text-xs font-bold text-gray-400 uppercase tracking-wider">Trending tags</small>
                                <h6 class="text-lg font-bold text-gray-900">Live conversations</h6>
                            </div>
                            <i class="fas fa-sparkles text-rose-500"></i>
                        </div>
                        <div class="space-y-3">
                            @foreach($trendList as $topic)
                                <div class="flex items-center justify-between pb-2 border-b border-gray-50 last:border-0 last:pb-0">
                                    <div>
                                        <p class="font-bold text-gray-700 text-sm">#{{ $topic['tag'] }}</p>
                                        <small class="text-xs text-gray-400">{{ $topic['count'] }} mentions · {{ $topic['direction'] === 'up' ? 'Rising' : ($topic['direction'] === 'down' ? 'Cooling' : 'Holding') }}</small>
                                    </div>
                                    <span class="px-2 py-1 rounded-lg text-xs font-bold {{ $topic['direction'] === 'down' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600' }}">
                                        {{ $topic['change'] > 0 ? '+' : '' }}{{ $topic['change'] ?? 0 }}
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endif

                <!-- Connections -->
                <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl shadow-sm p-6 border border-indigo-100">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <small class="text-xs font-bold text-indigo-400 uppercase tracking-wider">Suggested connections</small>
                            <h6 class="text-lg font-bold text-indigo-950">People driving these conversations</h6>
                        </div>
                        <i class="fas fa-user-friends text-indigo-500"></i>
                    </div>
                    <div class="space-y-4">
                        @forelse($suggestions as $suggestion)
                            <div class="flex items-center justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                <div class="flex items-center gap-3">
                                    <img src="{{ $suggestion['avatar_url'] }}" alt="{{ $suggestion['display_name'] }}" class="w-10 h-10 rounded-full object-cover">
                                    <div>
                                        <a href="{{ $suggestion['profile_url'] }}" class="font-bold text-gray-900 hover:text-rose-600 text-sm block transition-colors">
                                            {{ $suggestion['display_name'] }}
                                        </a>
                                        @if(!empty($suggestion['reason']))
                                            <div class="text-xs text-gray-400 mt-0.5">{{ $suggestion['reason'] }}</div>
                                        @endif
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    class="px-3 py-1 rounded-full text-xs font-bold transition-colors {{ $suggestion['is_following'] ? 'border border-gray-200 text-gray-500 hover:bg-gray-50' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm' }}"
                                    data-follow-button
                                    data-username="{{ $suggestion['username'] }}"
                                    data-following="{{ $suggestion['is_following'] ? 'true' : 'false' }}"
                                >
                                    {{ $suggestion['is_following'] ? 'Following' : 'Follow' }}
                                </button>
                            </div>
                        @empty
                            <div class="text-center py-8 px-4">
                                <p class="text-gray-900 font-bold text-sm mb-1">No suggestions yet</p>
                                <p class="text-gray-500 text-xs">We will surface more profiles as you interact with posts.</p>
                            </div>
                        @endforelse
                    </div>
                </div>

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

            </aside>
        </div>
    </div>
</div>

@push('scripts')
<script>
    // Re-initialize social interactions if needed, though they are likely global
    if (window.socialInteractions) {
        window.socialInteractions.init();
    }
</script>
@endpush
@endsection
