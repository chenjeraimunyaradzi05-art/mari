@extends('frontend.social.layout')

@section('title', 'Following · ' . ($profile->display_name ?? '@' . $profile->username))

@section('social-content')
<div class="container following-wrapper">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div>
            <p class="text-muted mb-1">@{{ $profile->username }}</p>
            <h2 class="fw-bold mb-0">Following</h2>
        </div>
        <a href="{{ route('social.profiles.show', $profile->username) }}" class="btn btn-outline-secondary btn-sm">
            <i class="fas fa-arrow-left me-1"></i> Back to profile
        </a>
    </div>

    @forelse($following as $item)
        <div class="following-card">
            <div class="following-card__profile">
                <img src="{{ $item->avatar_url }}" alt="{{ $item->display_name ?? $item->username }}" class="following-card__avatar">
                <div>
                    <div class="following-card__name">{{ $item->display_name ?? $item->resolveOwnerUser()?->name ?? '@'.$item->username }}</div>
                    <div class="following-card__handle">@{{ $item->username }}</div>
                    <div class="following-card__meta">
                        @if($item->is_private)
                            <span class="following-card__badge"><i class="fas fa-lock me-1"></i> Private</span>
                        @endif
                        @if($item->profile_type)
                            <span class="following-card__badge text-capitalize">{{ str_replace('_', ' ', $item->profile_type) }}</span>
                        @endif
                    </div>
                </div>
            </div>
            <div class="following-card__actions">
                <a href="{{ route('social.profiles.show', $item->username) }}" class="btn btn-outline-primary btn-sm">View profile</a>
                @if($currentProfile && $currentProfile->id !== $item->id)
                    <span class="badge bg-primary-subtle text-primary"><i class="fas fa-user-check me-1"></i> Following</span>
                @endif
            </div>
        </div>
    @empty
        <div class="empty-state">
            <i class="fas fa-user-friends mb-3" style="font-size: 2rem;"></i>
            <p class="mb-0">You are not following anyone yet. Explore profiles to start building your feed.</p>
        </div>
    @endforelse

    <div class="mt-4">
        {{ $following->withQueryString()->links() }}
    </div>
</div>
@endsection
