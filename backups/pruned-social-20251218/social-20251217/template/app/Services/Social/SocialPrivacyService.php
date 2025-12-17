<?php

namespace App\Services\Social;

use App\Models\Connection;
use App\Models\SocialFollow;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class SocialPrivacyService
{
    /** @var array<string, bool> */
    private array $connectionCache = [];
    /** @var array<string, bool> */
    private array $followCache = [];

    public function canViewPost(?User $viewer, SocialPost $post): bool
    {
        $ownerProfile = $this->resolveOwnerProfile($post);

        if ($viewer && $this->ownsPost($viewer, $post)) {
            return true;
        }

        if ($this->violatesPrivatePersonaVisibility($ownerProfile, $viewer)) {
            return false;
        }

        if ($post->visibility === 'public') {
            return true;
        }

        if ($this->candidatePrivacyBlocks($viewer, $post, $ownerProfile)) {
            return false;
        }

        if ($post->visibility === 'private') {
            return false;
        }

        if (! $viewer) {
            return false;
        }

        $ownerId = $this->resolveOwnerId($post);
        if (! $ownerId) {
            return false;
        }

        return $this->hasAcceptedConnection($viewer->id, $ownerId);
    }

    public function canInteract(User $viewer, SocialPost $post): bool
    {
        return $this->canViewPost($viewer, $post);
    }

    public function assertCanInteract(User $viewer, SocialPost $post): void
    {
        abort_unless($this->canInteract($viewer, $post), 403, 'You are not allowed to engage with this post.');
    }

    /**
     * @psalm-return Collection<int, mixed>
     */
    public function filterVisiblePosts(Collection $posts, ?User $viewer): Collection
    {
        return $posts->filter(fn (SocialPost $post) => $this->canViewPost($viewer, $post))->values();
    }

    private function ownsPost(User $viewer, SocialPost $post): bool
    {
        return (int) $post->user_id === (int) $viewer->id;
    }

    private function resolveOwnerId(SocialPost $post): ?int
    {
        if ($post->user_id) {
            return (int) $post->user_id;
        }

        return $post->profile?->user_id;
    }

    private function hasAcceptedConnection(int $userId, int $otherUserId): bool
    {
        if ($userId === $otherUserId) {
            return true;
        }

        $key = $userId.'-'.$otherUserId;
        if (array_key_exists($key, $this->connectionCache)) {
            return $this->connectionCache[$key];
        }

        $exists = Connection::query()
            ->where('status', Connection::STATUS_ACCEPTED)
            ->where(function ($query) use ($userId, $otherUserId) {
                $query->where(function ($inner) use ($userId, $otherUserId) {
                    $inner->where('user_id', $userId)->where('connected_user_id', $otherUserId);
                })->orWhere(function ($inner) use ($userId, $otherUserId) {
                    $inner->where('user_id', $otherUserId)->where('connected_user_id', $userId);
                });
            })
            ->exists();

        $this->connectionCache[$key] = $exists;

        return $exists;
    }

    private function candidatePrivacyBlocks(?User $viewer, SocialPost $post, ?SocialProfile $ownerProfile = null): bool
    {
        $ownerProfile ??= $post->profile;
        if (! $ownerProfile) {
            return false;
        }

        if (! $this->isCandidateProfile($ownerProfile)) {
            return false;
        }

        if ($viewer && $ownerProfile->user_id === $viewer->id) {
            return false;
        }

        $viewerProfile = $viewer?->socialProfile;
        if (! $viewerProfile) {
            return $post->visibility !== 'public';
        }

        if ($this->isCandidateProfile($viewerProfile) && $post->visibility !== 'public') {
            return true;
        }

        if (! $this->isRecruiterProfile($viewerProfile) && $post->visibility !== 'public') {
            return true;
        }

        return false;
    }

    private function violatesPrivatePersonaVisibility(?SocialProfile $ownerProfile, ?User $viewer): bool
    {
        if (! $ownerProfile || ! $ownerProfile->is_private) {
            return false;
        }

        if ($viewer && $ownerProfile->isOwnedByUser($viewer)) {
            return false;
        }

        $viewerProfile = $viewer?->socialProfile;
        if (! $viewerProfile) {
            return true;
        }

        return ! $this->viewerFollowsProfile($viewerProfile->getKey(), $ownerProfile->getKey());
    }

    private function isCandidateProfile(?SocialProfile $profile): bool
    {
        if (! $profile) {
            return false;
        }

        $types = config('social.privacy.candidate_profile_types', ['candidate', 'trainee']);

        return in_array($profile->profile_type, $types, true)
            || Str::startsWith((string) $profile->persona_key, 'candidate');
    }

    private function isRecruiterProfile(?SocialProfile $profile): bool
    {
        if (! $profile) {
            return false;
        }

        $types = config('social.privacy.recruiter_profile_types', ['company', 'business', 'government', 'education_provider']);

        return in_array($profile->profile_type, $types, true)
            || Str::startsWith((string) $profile->persona_key, ['org-', 'company']);
    }

    private function viewerFollowsProfile(int $viewerProfileId, int $ownerProfileId): bool
    {
        if ($viewerProfileId === $ownerProfileId) {
            return true;
        }

        $key = $viewerProfileId.'-'.$ownerProfileId;
        if (array_key_exists($key, $this->followCache)) {
            return $this->followCache[$key];
        }

        $exists = SocialFollow::query()
            ->where('follower_id', $viewerProfileId)
            ->where('following_id', $ownerProfileId)
            ->exists();

        $this->followCache[$key] = $exists;

        return $exists;
    }

    private function resolveOwnerProfile(SocialPost $post): ?SocialProfile
    {
        if ($post->relationLoaded('profile') && $post->profile) {
            return $post->profile;
        }

        if ($post->social_profile_id) {
            return SocialProfile::query()->find($post->social_profile_id);
        }

        return null;
    }
}

