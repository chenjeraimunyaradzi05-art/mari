<?php

namespace App\Services\Social;

use App\Models\Candidate;
use App\Models\Company;
use App\Models\Notification;
use App\Models\SocialComment;
use App\Models\SocialNotificationPreference;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\RealTimeNotificationService;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

final class SocialNotificationService
{
    private array $preferenceCache = [];

    public function __construct(private ?RealTimeNotificationService $realTime = null)
    {
    }

    public function notifyPostPublished(SocialPost $post): void
    {
        $profile = $post->profile;

        if (! $profile) {
            return;
        }

        $authorUser = $this->resolveUser($profile);

        $followers = $profile->followers()
            ->with('profileable')
            ->wherePivot('notifications_enabled', true)
            ->get();

        foreach ($followers as $followerProfile) {
            $recipient = $this->resolveUser($followerProfile);

            if (! $recipient || ($authorUser && $recipient->is($authorUser))) {
                continue;
            }

            $this->storeNotification($recipient, 'social.post.published', [
                'post_id' => $post->id,
                'author_profile_id' => $profile->id,
                'author_name' => $profile->display_name ?? $authorUser?->name,
            ]);
        }
    }

    public function notifyPostLiked(SocialPost $post, SocialProfile $actor): void
    {
        $recipient = $this->resolveUser($post->profile);
        $actorUser = $this->resolveUser($actor);

        if (! $recipient || ! $actorUser || $recipient->is($actorUser)) {
            return;
        }

        $this->storeNotification($recipient, 'social.post.liked', [
            'post_id' => $post->id,
            'actor_id' => $actorUser->id,
            'actor_name' => $actor->display_name ?? $actorUser->name,
        ]);
    }

    public function notifyPostCommented(SocialPost $post, SocialComment $comment, SocialProfile $actor): void
    {
        $authorUser = $this->resolveUser($post->profile);
        $actorUser = $this->resolveUser($actor);

        if ($authorUser && (! $actorUser || ! $authorUser->is($actorUser))) {
            $this->storeNotification($authorUser, 'social.post.commented', [
                'post_id' => $post->id,
                'comment_id' => $comment->id,
                'actor_id' => $actorUser?->id,
                'snippet' => Str::limit((string) $comment->comment, 120),
            ]);
        }

        if (! $comment->parent_id) {
            return;
        }

        $parent = $comment->parent()->with('profile.profileable')->first();

        if (! $parent || ! $parent->profile) {
            return;
        }

        $parentUser = $this->resolveUser($parent->profile);

        if (! $parentUser || ($actorUser && $parentUser->is($actorUser))) {
            return;
        }

        if ($authorUser && $parentUser->is($authorUser)) {
            return;
        }

        $this->storeNotification($parentUser, 'social.comment.replied', [
            'post_id' => $post->id,
            'comment_id' => $comment->id,
            'actor_id' => $actorUser?->id,
        ]);
    }

    public function notifyFollowed(SocialProfile $actor, SocialProfile $target): void
    {
        $recipient = $this->resolveUser($target);
        $actorUser = $this->resolveUser($actor);

        if (! $recipient || ! $actorUser || $recipient->is($actorUser)) {
            return;
        }

        $this->storeNotification($recipient, 'social.profile.followed', [
            'actor_id' => $actorUser->id,
            'actor_name' => $actor->display_name ?? $actorUser->name,
            'target_profile_id' => $target->id,
        ]);
    }

    public function notifyProfileUpdated(SocialProfile $profile, array $changes = []): void
    {
        $ownerUser = $this->resolveUser($profile);

        if (! $ownerUser) {
            return;
        }

        $followers = $profile->followers()
            ->with('profileable')
            ->wherePivot('notifications_enabled', true)
            ->get();

        foreach ($followers as $followerProfile) {
            $recipient = $this->resolveUser($followerProfile);

            if (! $recipient || $recipient->is($ownerUser)) {
                continue;
            }

            $this->storeNotification($recipient, 'social.profile.updated', [
                'profile_id' => $profile->id,
                'profile_name' => $profile->display_name ?? $ownerUser->name,
                'changes' => array_values($changes),
            ]);
        }
    }

    private function storeNotification(User $user, string $type, array $data): void
    {
        if (! $this->shouldNotify($user, $type)) {
            return;
        }

        Notification::create([
            'user_id' => $user->id,
            'type' => $type,
            'data' => $data,
        ]);

        if ($this->realTime instanceof RealTimeNotificationService) {
            try {
                $this->realTime->broadcast($user, $type, $data);
            } catch (\Throwable $exception) {
                Log::warning('social.notifications.broadcast_failed', [
                    'user_id' => $user->id,
                    'type' => $type,
                    'message' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function resolveUser(?SocialProfile $profile): ?User
    {
        if (! $profile) {
            return null;
        }

        $owner = $profile->profileable;

        if ($owner instanceof User) {
            return $owner;
        }

        if ($owner instanceof Candidate) {
            return $owner->relationLoaded('user') ? $owner->user : $owner->user()->first();
        }

        if ($owner instanceof Company) {
            return $owner->relationLoaded('user') ? $owner->user : $owner->user()->first();
        }

        return null;
    }

    private function shouldNotify(User $user, string $type): bool
    {
        $category = $this->categoryForType($type);
        $preferences = $this->preferenceFor($user);

        return $preferences->channelEnabled($category, 'in_app');
    }

    private function preferenceFor(User $user): SocialNotificationPreference
    {
        if (! array_key_exists($user->id, $this->preferenceCache)) {
            $this->preferenceCache[$user->id] = SocialNotificationPreference::firstOrCreate(
                ['user_id' => $user->id],
                ['settings' => SocialNotificationPreference::defaults()]
            );
        }

        return $this->preferenceCache[$user->id];
    }

    private function categoryForType(string $type): string
    {
        $map = [
            'social.post.published' => 'posts',
            'social.post.liked' => 'reactions',
            'social.post.commented' => 'comments',
            'social.comment.replied' => 'comments',
            'social.profile.followed' => 'follows',
            'social.profile.updated' => 'posts',
        ];

        return $map[$type] ?? 'posts';
    }
}

