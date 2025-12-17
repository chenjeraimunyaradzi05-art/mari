<?php

namespace App\Services;

use App\Events\PostCreated;
use App\Models\MediaUploadSession;
use App\Models\SocialComment;
use App\Models\SocialLike;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\Social\SocialPrivacyService;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

final class SocialInteractionService
{


    public function createPost(User $user, array $data): SocialPost
    {
        $mediaPayload = $this->prepareMediaPayload($user, $data['media'] ?? []);

        if (empty($data['content']) && empty($mediaPayload)) {
            throw ValidationException::withMessages([
                'content' => 'Content or media is required.',
            ]);
        }

        $profile = $this->getProfileOrFail($user);

        return DB::transaction(function () use ($user, $data, $profile, $mediaPayload) {
            $post = SocialPost::create([
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'type' => $data['type'] ?? 'feed',
                'post_type' => $data['post_type'] ?? 'post',
                'content' => $data['content'] ?? null,
                'meta' => $data['meta'] ?? null,
                'media' => $this->serializeMediaForPost($mediaPayload),
                'location' => $data['location'] ?? null,
                'tags' => $data['tags'] ?? [],
                'mentions' => $data['mentions'] ?? [],
                'visibility' => $data['visibility'] ?? 'public',
                'moderation_status' => 'pending',
                'is_sponsored' => (bool) ($data['is_sponsored'] ?? false),
                'published_at' => Carbon::parse($data['published_at'] ?? Carbon::now()),
                'expires_at' => isset($data['expires_at']) ? Carbon::parse($data['expires_at']) : null,
                'comments_disabled' => (bool) ($data['comments_disabled'] ?? false),
                'is_pinned' => (bool) ($data['is_pinned'] ?? false),
                'ai_engagement_score' => (float) ($data['ai_engagement_score'] ?? 0),
                'ai_tags' => $data['ai_tags'] ?? [],
            ]);

            foreach ($mediaPayload as $index => $media) {
                SocialMedia::create([
                    'social_post_id' => $post->id,
                    'media_type' => $media['media_type'] ?? 'image',
                    'file_path' => $media['file_path'],
                    'thumbnail_path' => Arr::get($media, 'thumbnail_path'),
                    'mime_type' => Arr::get($media, 'mime_type'),
                    'file_size' => Arr::get($media, 'file_size'),
                    'width' => Arr::get($media, 'width'),
                    'height' => Arr::get($media, 'height'),
                    'duration' => Arr::get($media, 'duration'),
                    'order' => Arr::get($media, 'order', $index),
                    'ai_analysis' => Arr::get($media, 'ai_analysis'),
                    'filters' => Arr::get($media, 'filters'),
                ]);
            }

            if ($profile->getKey()) {
                $profile->newQuery()->whereKey($profile->getKey())->increment('posts_count');
            }
            // update in-memory attribute safely (avoid modifying a @property-read doc-parsed property)
            $profile->setAttribute('posts_count', (int) $profile->getAttribute('posts_count') + 1);

            Log::info('social.post.created', [
                'post_id' => $post->id,
                'user_id' => $user->id,
            ]);

            $this->scheduleAIEnrichment($post);
            $this->broadcastPostCreated($post, $profile);

            return $post->load(['media', 'profile']);
        });
    }

    public function deletePost(User $user, SocialPost $post): void
    {
        abort_unless($post->user_id === $user->id, 403, 'You cannot delete this post.');

        $profile = $post->profile;

        DB::transaction(function () use ($post, $profile) {
            $post->media()->delete();
            $post->likes()->delete();
            $post->reactions()->delete();
            $post->comments()->delete();
            $post->impressions()->delete();
            $post->moderationEvents()->delete();
            $post->reports()->delete();
            $post->delete();

            if ($profile) {
                $this->safeDecrement($profile, 'posts_count');
            }
        });

        Log::info('social.post.deleted', [
            'post_id' => $post->id,
        ]);
    }

    public function addReaction(User $user, SocialPost $post, string $reaction): SocialLike
    {
        $this->privacyService->assertCanInteract($user, $post);
        $normalized = strtolower($reaction);

        $profile = $this->getProfileOrFail($user);

        $record = SocialLike::updateOrCreate(
            [
                'social_profile_id' => $profile->id,
                'likeable_type' => SocialPost::class,
                'likeable_id' => $post->id,
            ],
            [
                'social_post_id' => $post->id,
                'user_id' => $user->id,
                'reaction' => $normalized,
                'liked_at' => now(),
            ]
        );

            if ($record->wasRecentlyCreated && $post->getKey()) {
                $post->newQuery()->whereKey($post->getKey())->increment('likes_count');
                $post->setAttribute('likes_count', (int) $post->getAttribute('likes_count') + 1);
            }

        return $record;
    }

    public function removeReaction(User $user, SocialPost $post, ?string $reaction = null): void
    {
        $this->privacyService->assertCanInteract($user, $post);
        $profile = $this->getProfileOrFail($user);

        $query = SocialLike::query()
            ->where('social_profile_id', $profile->id)
            ->where('likeable_type', SocialPost::class)
            ->where('likeable_id', $post->id);

        if ($reaction) {
            $query->where('reaction', strtolower($reaction));
        }

        $deleted = $query->delete();

        if ($deleted) {
            $this->safeDecrement($post, 'likes_count');
        }
    }

    public function addComment(User $user, SocialPost $post, string $content, array $context = []): SocialComment
    {
        $this->privacyService->assertCanInteract($user, $post);
        $parentId = $context['parent_id'] ?? null;

        if ($parentId) {
            $parent = SocialComment::query()
                ->where('id', $parentId)
                ->where('social_post_id', $post->id)
                ->first();

            abort_if(!$parent, 422, 'Invalid parent comment.');
        }

        $profile = $this->getProfileOrFail($user);

        $comment = SocialComment::create([
            'social_post_id' => $post->id,
            'user_id' => $user->id,
            'social_profile_id' => $profile->id,
            'parent_id' => $parentId,
            'content' => $content,
            'mentions' => Arr::get($context, 'mentions', []),
            'meta' => Arr::get($context, 'meta'),
        ]);

        if ($post->getKey()) {
            $post->newQuery()->whereKey($post->getKey())->increment('comments_count');
            $post->setAttribute('comments_count', (int) $post->getAttribute('comments_count') + 1);
        }

        if (isset($parent)) {
            if ($parent->getKey()) {
                $parent->newQuery()->whereKey($parent->getKey())->increment('replies_count');
            }
            $parent->setAttribute('replies_count', (int) $parent->getAttribute('replies_count') + 1);
        }

        return $comment;
    }

    /**
     * @return ((mixed|string)[]|null)[]
     *
     * @psalm-return array<int, array<'image'|mixed>|null>
     */
    private function prepareMediaPayload(User $user, array $mediaItems): array
    {
        return collect($mediaItems)
            ->map(function (array $media) use ($user) {
                $sessionPayload = $this->resolveSessionAttachment($user, $media);

                if (! empty($sessionPayload)) {
                    return $sessionPayload;
                }

                $path = $media['path'] ?? $media['file_path'] ?? null;
                if (! $path) {
                    return null;
                }

                return array_filter([
                    'file_path' => $path,
                    'thumbnail_path' => $media['thumbnail_path'] ?? $media['thumbnail'] ?? null,
                    'media_type' => $media['type'] ?? 'image',
                    'mime_type' => $media['mime_type'] ?? null,
                    'file_size' => $media['file_size'] ?? null,
                    'width' => $media['width'] ?? null,
                    'height' => $media['height'] ?? null,
                    'duration' => $media['duration'] ?? null,
                    'order' => $media['order'] ?? $media['sort_order'] ?? null,
                    'ai_analysis' => $media['ai_analysis'] ?? null,
                    'filters' => $media['filters'] ?? null,
                ], fn ($value) => $value !== null);
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return (int|mixed|string)[]
     *
     * @psalm-return array<string, int|mixed|string>
     */
    private function resolveSessionAttachment(User $user, array $media): array
    {
        $sessionId = $media['upload_session_id'] ?? null;
        $sessionUuid = $media['upload_session_uuid'] ?? null;

        if (! $sessionId && ! $sessionUuid) {
            return [];
        }

        $query = MediaUploadSession::query()
            ->where('user_id', $user->id)
            ->where('status', MediaUploadSession::STATUS_COMPLETED);

        if ($sessionUuid) {
            $query->where('uuid', $sessionUuid);
        } else {
            $query->whereKey($sessionId);
        }

        $session = $query->first();

        if (! $session) {
            throw ValidationException::withMessages([
                'media' => 'The referenced media upload session is missing or incomplete.',
            ]);
        }

        return array_filter([
            'file_path' => $session->storage_path,
            'thumbnail_path' => $session->thumbnail_path,
            'media_type' => $session->media_type,
            'mime_type' => $session->mime_type,
            'file_size' => $session->total_size,
            'width' => Arr::get($session->meta, 'width'),
            'height' => Arr::get($session->meta, 'height'),
            'duration' => Arr::get($session->meta, 'duration'),
            'order' => Arr::get($media, 'order'),
        ], fn ($value) => $value !== null);
    }

    /**
     * @return array[]
     *
     * @psalm-return array<array<'path'|'thumbnail'|'type', mixed>>
     */
    private function serializeMediaForPost(array $mediaPayload): array
    {
        return array_map(function (array $media) {
            return array_filter([
                'path' => $media['file_path'] ?? null,
                'thumbnail' => $media['thumbnail_path'] ?? null,
                'type' => $media['media_type'] ?? null,
            ], fn ($value) => $value !== null);
        }, $mediaPayload);
    }

    private function getProfileOrFail(User $user): SocialProfile
    {
        $profile = $user->socialProfile;

        if (! $profile) {
            throw ValidationException::withMessages([
                'user' => 'User does not have a social profile configured.',
            ]);
        }

        return $profile;
    }

    private function safeDecrement(EloquentModel $model, string $column): void
    {
        $value = (int) $model->getAttribute($column);

        if ($value > 0 && $model->getKey()) {
            $model->newQuery()->whereKey($model->getKey())->decrement($column);
            $model->setAttribute($column, max(0, $value - 1));
        }
    }

    private function scheduleAIEnrichment(SocialPost $post): void
    {
        $callback = function () use ($post): void {
            $freshPost = $post->fresh() ?? $post;
            $analysis = $this->aiContentService->analyzePost($freshPost);

            if (empty($analysis)) {
                return;
            }

            $freshPost->forceFill([
                'ai_tags' => $analysis['tags'] ?? $freshPost->ai_tags,
                'ai_engagement_score' => (float) ($analysis['engagement_score'] ?? $freshPost->ai_engagement_score),
            ])->save();
        };

        if (DB::transactionLevel() === 0 || app()->runningUnitTests()) {
            $callback();

            return;
        }

        DB::afterCommit($callback);
    }

    private function broadcastPostCreated(SocialPost $post, SocialProfile $profile): void
    {
        $followerIds = $this->resolveFollowerUserIds($profile);

        if (empty($followerIds)) {
            return;
        }

        $dispatcher = function () use ($post, $followerIds): void {
            $freshPost = $post->fresh(['profile']) ?? $post;
            event(new PostCreated($freshPost, $followerIds));
        };

        if (DB::transactionLevel() === 0 || app()->runningUnitTests()) {
            $dispatcher();

            return;
        }

        DB::afterCommit($dispatcher);
    }

    /**
     * @return array<int, int>
     */
    private function resolveFollowerUserIds(SocialProfile $profile): array
    {
        return $profile->followers()
            ->wherePivot('notifications_enabled', true)
            ->whereNotNull('social_profiles.user_id')
            ->pluck('social_profiles.user_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}

