@extends('frontend.social.layout')

@section('title', 'Search the Feed')

@php
    use Illuminate\Support\Str;
@endphp

@section('social-content')
<div class="feed-shell" data-feed-search>
    <form action="{{ route('social.feed.search') }}" method="GET" class="mb-6">
        <div class="flex flex-col md:flex-row gap-3">
            <input
                type="text"
                name="q"
                value="{{ $query }}"
                placeholder="Search people, hashtags, or opportunities"
                class="flex-1 rounded-3xl border border-slate-200 px-5 py-3 text-base focus:border-rose-400 focus:ring-rose-200"
                autofocus
            >
            <button type="submit" class="px-6 py-3 rounded-3xl bg-rose-600 text-white font-semibold shadow-md hover:bg-rose-500">
                <i class="fas fa-search me-2"></i>Search
            </button>
        </div>
    </form>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-4">
            <div class="rounded-3xl border border-slate-200 bg-white p-4">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <div>
                        <p class="text-xs uppercase text-muted mb-1" style="letter-spacing: 0.18em;">Profiles</p>
                        <h6 class="mb-0">Matches</h6>
                    </div>
                    <i class="fas fa-users text-rose-400"></i>
                </div>
                @forelse($profiles as $profile)
                    <div class="d-flex align-items-center justify-content-between py-3 border-top @if($loop->first) border-top-0 @endif">
                        <div class="d-flex align-items-center gap-3">
                            <img src="{{ $profile->avatar_url }}" alt="{{ $profile->display_name ?? $profile->username }}" class="w-10 h-10 rounded-full object-cover">
                            <div>
                                <a href="{{ route('social.profiles.show', $profile->username) }}" class="fw-semibold text-decoration-none text-dark">
                                    {{ $profile->display_name ?? $profile->username }}
                                </a>
                                <span class="d-block text-sm text-muted">@{{ $profile->username }}</span>
                            </div>
                        </div>
                        <span class="badge bg-light text-muted">{{ number_format($profile->followers_count ?? 0) }} followers</span>
                    </div>
                @empty
                    <p class="text-muted mb-0">No profiles match this query yet.</p>
                @endforelse
            </div>
        </div>

        <div class="lg:col-span-8">
            <div class="rounded-3xl border border-slate-200 bg-white p-4 mb-4">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div>
                        <p class="text-xs uppercase text-muted mb-1" style="letter-spacing: 0.18em;">Posts</p>
                        <h6 class="mb-0">Content spotlight</h6>
                    </div>
                    @if($query)
                        <span class="badge bg-rose-100 text-rose-600">{{ Str::of($query)->limit(32) }}</span>
                    @endif
                </div>
                <p class="text-muted mb-0">We search captions, tags, and AI topics for relevant stories.</p>
            </div>

            @if(($posts ?? collect())->isNotEmpty())
                @include('social.feed.partials.posts', ['posts' => $posts])
            @else
                <div class="rounded-3xl border border-dashed border-slate-200 p-8 text-center bg-white">
                    <p class="mb-2 fw-semibold text-slate-700">Nothing yet</p>
                    <p class="mb-0 text-slate-500">Try a different keyword or explore trending content.</p>
                </div>
            @endif
        </div>
    </div>
</div>
@endsection
