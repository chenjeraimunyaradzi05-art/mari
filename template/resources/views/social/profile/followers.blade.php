@extends('frontend.social.layout')

@section('title', 'Followers · ' . ($profile->display_name ?? '@' . $profile->username))

@section('social-content')
<div class="container follow-list-wrapper">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div>
            <p class="text-muted mb-1">@{{ $profile->username }}</p>
            <h2 class="fw-bold mb-0">Followers</h2>
        </div>
        <a href="{{ route('social.profiles.show', $profile->username) }}" class="btn btn-outline-secondary btn-sm">
            <i class="fas fa-arrow-left me-1"></i> Back to profile
        </a>
    </div>

    @forelse($followers as $follower)
        <div class="follow-card">
            <div class="follow-card__profile">
                <img src="{{ $follower->avatar_url }}" alt="{{ $follower->display_name ?? $follower->username }}" class="follow-card__avatar">
                <div>
                    <div class="follow-card__name">{{ $follower->display_name ?? $follower->resolveOwnerUser()?->name ?? '@'.$follower->username }}</div>
                    <div class="follow-card__handle">@{{ $follower->username }}</div>
                    <div class="follow-card__badges">
                        @if($follower->is_verified)
                            <span class="follow-card__badge"><i class="fas fa-check-circle me-1"></i> Verified</span>
                        @endif
                        @if($follower->profile_type)
                            <span class="follow-card__badge text-capitalize">{{ str_replace('_', ' ', $follower->profile_type) }}</span>
                        @endif
                    </div>
                </div>
            </div>
            <div class="follow-card__actions">
                <a href="{{ route('social.profiles.show', $follower->username) }}" class="btn btn-outline-primary btn-sm">View profile</a>
                @if($currentProfile && $currentProfile->id !== $follower->id)
                    @if($currentProfile->isFollowing($follower))
                        <span class="badge bg-light text-success"><i class="fas fa-user-check me-1"></i> Following</span>
                    @else
                        <span class="badge bg-light text-muted"><i class="fas fa-user-plus me-1"></i> Not following</span>
                    @endif
                @endif
            </div>
        </div>
    @empty
        <div class="empty-state">
            <i class="fas fa-users mb-3" style="font-size: 2rem;"></i>
            <p class="mb-0">No followers yet. Encourage your network to connect!</p>
        </div>
    @endforelse

    <div class="mt-4">
        {{ $followers->withQueryString()->links() }}
    </div>
</div>
@endsection
