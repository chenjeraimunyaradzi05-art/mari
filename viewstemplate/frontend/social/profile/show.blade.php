@extends('frontend.social.layout')

@section('social-content')
<div class="space-y-8">
    <section class="relative overflow-hidden rounded-3xl bg-white/95 shadow-xl shadow-indigo-100/60">
        <div class="h-44 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200">
            <img
                src="{{ $profile->cover_url }}"
                alt="{{ $profile->display_name ?? $profile->username }} cover"
                class="h-full w-full object-cover"
            >
        </div>
        <div class="relative px-6 pb-8">
            <div class="relative -mt-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div class="flex flex-col gap-4 md:flex-row md:items-end">
                    <div class="h-32 w-32 overflow-hidden rounded-3xl border-4 border-white shadow-lg shadow-indigo-200">
                        <img
                            src="{{ $profile->avatar_url }}"
                            alt="{{ $profile->display_name ?? $profile->username }} avatar"
                            class="h-full w-full object-cover"
                        >
                    </div>
                    <div class="space-y-2">
                        <div class="flex flex-wrap items-center gap-3">
                            <h1 class="text-2xl font-semibold text-slate-900">
                                {{ $profile->display_name ?? $profile->user?->name ?? '@'.$profile->username }}
                            </h1>
                            @if($profile->is_verified)
                                <span class="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                                    <i class="fas fa-badge-check"></i>
                                    Verified
                                </span>
                            @endif
                            @if($profile->profile_type)
                                <span class="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-500">
                                    <i class="fas fa-id-badge"></i>
                                    {{ ucfirst($profile->profile_type) }}
                                </span>
                            @endif
                        </div>
                        <p class="text-sm text-slate-600">
                            {{ '@'.$profile->username }}
                            @if($profile->is_private)
                                <span class="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
                                    <i class="fas fa-lock"></i>
                                    Private account
                                </span>
                            @endif
                        </p>
                        @if($profile->bio)
                            <p class="max-w-2xl text-sm leading-relaxed text-slate-700">
                                {{ $profile->bio }}
                            </p>
                        @else
                            <p class="max-w-2xl text-sm text-slate-500">
                                This profile is warming up—share a little about your journey to let mentors and allies know where to jump in.
                            </p>
                        @endif
                        @if($profile->website)
                            <a
                                href="{{ $profile->website }}"
                                target="_blank"
                                rel="noopener"
                                class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                            >
                                <i class="fas fa-globe"></i>
                                {{ parse_url($profile->website, PHP_URL_HOST) ?? $profile->website }}
                            </a>
                        @endif
                        @if(!empty($profile->social_links))
                            <div class="flex flex-wrap gap-3">
                                @foreach($profile->social_links as $link)
                                    <a
                                        href="{{ $link['url'] ?? '#' }}"
                                        target="_blank"
                                        rel="noopener"
                                        class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                                    >
                                        <i class="fas fa-link"></i>
                                        {{ $link['label'] ?? 'Link' }}
                                    </a>
                                @endforeach
                            </div>
                        @endif
                    </div>
                </div>
                <div class="flex items-center gap-3 pb-2">
                    @if($isOwner)
                        <a
                            href="{{ route('social.profiles.edit', $profile->username) }}"
                            class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                        >
                            <i class="fas fa-pen"></i>
                            Edit profile
                        </a>
                    @else
                        <form
                            action="{{ $isFollowing ? route('social.profiles.unfollow', $profile->username) : route('social.profiles.follow', $profile->username) }}"
                            method="POST"
                        >
                            @csrf
                            @if($isFollowing)
                                @method('DELETE')
                            @endif
                            <button
                                type="submit"
                                class="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold shadow transition
                                    {{ $isFollowing ? 'border-slate-300 bg-white text-slate-700 hover:border-rose-200 hover:text-rose-600' : 'border-transparent bg-rose-500 text-white hover:bg-rose-600' }}"
                            >
                                <i class="fas {{ $isFollowing ? 'fa-user-check' : 'fa-user-plus' }}"></i>
                                {{ $isFollowing ? 'Following' : 'Follow' }}
                            </button>
                        </form>
                    @endif
                </div>
            </div>
        </div>
    </section>

    <section class="grid gap-4 rounded-3xl border border-indigo-100 bg-white/95 p-6 shadow-md shadow-indigo-100/50 md:grid-cols-4">
        <div class="md:col-span-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-500">Network Status</p>
            <p class="mt-2 text-sm text-slate-600">Snapshot of how this profile is growing across WomenRise.</p>
        </div>
        <dl class="grid gap-4 md:col-span-3 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Followers</dt>
                <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($profile->followers_count ?? 0) }}</dd>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Following</dt>
                <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($profile->following_count ?? 0) }}</dd>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Stories Shared</dt>
                <dd class="mt-2 text-2xl font-semibold text-slate-900">{{ number_format($profile->posts_count ?? $posts->total()) }}</dd>
            </div>
        </dl>
    </section>

    <section class="grid gap-6 md:grid-cols-2">
        <div class="space-y-4 rounded-3xl border border-rose-100 bg-white/95 p-6 shadow-md shadow-rose-100/40">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-rose-600">Followers</h2>
                <a
                    href="#"
                    class="text-sm font-semibold text-rose-500 hover:text-rose-600"
                    data-network-modal="followers"
                >
                    View all
                </a>
            </div>
            <ul class="space-y-3">
                @forelse($followers as $follower)
                    <li class="flex items-center gap-3">
                        <img
                            src="{{ $follower->avatar_url }}"
                            alt="{{ $follower->display_name ?? $follower->username }} avatar"
                            class="h-10 w-10 rounded-xl object-cover"
                        >
                        <div class="flex-1">
                            <a
                                href="{{ route('social.profiles.show', $follower->username ?? 'me') }}"
                                class="text-sm font-semibold text-slate-900 hover:text-rose-600"
                            >
                                {{ $follower->display_name ?? $follower->user?->name ?? '@'.$follower->username }}
                            </a>
                            <p class="text-xs text-slate-500">{{ '@'.$follower->username }}</p>
                        </div>
                    </li>
                @empty
                    <li class="rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-500">
                        No followers yet. Invite collaborators to follow this story.
                    </li>
                @endforelse
            </ul>
        </div>
        <div class="space-y-4 rounded-3xl border border-indigo-100 bg-white/95 p-6 shadow-md shadow-indigo-100/40">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-indigo-600">Following</h2>
                <a
                    href="#"
                    class="text-sm font-semibold text-indigo-500 hover:text-indigo-600"
                    data-network-modal="following"
                >
                    View all
                </a>
            </div>
            <ul class="space-y-3">
                @forelse($following as $connection)
                    <li class="flex items-center gap-3">
                        <img
                            src="{{ $connection->avatar_url }}"
                            alt="{{ $connection->display_name ?? $connection->username }} avatar"
                            class="h-10 w-10 rounded-xl object-cover"
                        >
                        <div class="flex-1">
                            <a
                                href="{{ route('social.profiles.show', $connection->username ?? 'me') }}"
                                class="text-sm font-semibold text-slate-900 hover:text-indigo-600"
                            >
                                {{ $connection->display_name ?? $connection->user?->name ?? '@'.$connection->username }}
                            </a>
                            <p class="text-xs text-slate-500">{{ '@'.$connection->username }}</p>
                        </div>
                    </li>
                @empty
                    <li class="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-500">
                        Not following anyone yet. Explore the feed to spark new connections.
                    </li>
                @endforelse
            </ul>
        </div>
    </section>

    <section class="space-y-4">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-900">Recent posts</h2>
            @if($isOwner)
                <a
                    href="{{ route('social.posts.index') }}"
                    class="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                    Share a new story
                </a>
            @endif
        </div>
        <div class="space-y-4">
            @forelse($posts as $post)
                <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
                    <header class="flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-xl bg-indigo-100 text-center text-sm font-semibold leading-10 text-indigo-600">
                                {{ strtoupper(substr($profile->display_name ?? $profile->user?->name ?? $profile->username, 0, 2)) }}
                            </div>
                            <div>
                                <p class="text-sm font-semibold text-slate-900">{{ $profile->display_name ?? $profile->user?->name ?? '@'.$profile->username }}</p>
                                <p class="text-xs text-slate-500">{{ optional($post->published_at ?? $post->created_at)->diffForHumans() }}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-slate-500">
                            <i class="fas fa-eye"></i>
                            {{ ucfirst($post->visibility ?? 'public') }}
                        </div>
                    </header>
                    <div class="mt-4 space-y-4">
                        <p class="text-sm leading-relaxed text-slate-700">
                            {{ $post->content }}
                        </p>
                        @if(!empty($post->media))
                            @php
                                $mediaItems = is_array($post->media) ? $post->media : [];
                                $primary = $mediaItems[0]['path'] ?? null;
                            @endphp
                            @if($primary)
                                <div class="overflow-hidden rounded-2xl">
                                    <img src="{{ $primary }}" alt="Post media" class="h-64 w-full object-cover">
                                </div>
                            @endif
                        @endif
                    </div>
                    <footer class="mt-4 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm text-slate-500">
                        <span class="inline-flex items-center gap-2"><i class="fas fa-heart text-rose-500"></i>{{ number_format($post->reactions_count ?? $post->likes_count ?? 0) }}</span>
                        <span class="inline-flex items-center gap-2"><i class="fas fa-comment text-sky-500"></i>{{ number_format($post->comments_count ?? 0) }}</span>
                        <span class="inline-flex items-center gap-2"><i class="fas fa-share text-indigo-500"></i>{{ number_format($post->shares_count ?? 0) }}</span>
                    </footer>
                </article>
            @empty
                <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                    No posts yet. When stories are published they will appear here.
                </div>
            @endforelse
        </div>
        <div>
            {{ $posts->links() }}
        </div>
    </section>
</div>
@endsection
