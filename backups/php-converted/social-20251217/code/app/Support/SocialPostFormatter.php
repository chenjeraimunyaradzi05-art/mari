<?php

namespace App\Support;

use App\Models\SocialComment;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use function asset;
use function config;

final class SocialPostFormatter
{
    /**
     * @return ((array|mixed|string)[]|bool|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, user_id: int, author_type: string, content: null|string, tags: null|string, media: array, media_type: null|string, audience: array{sector: mixed, skills: list<non-empty-mixed>}, ai: array{tags: array, engagement_score: float|null}, match: array{score: 100|mixed, reasons: list{0?: 'Fresh story for your feed'}|mixed, insights: mixed}, counts: array{likes: int, comments: int, shares: int}, liked: bool|mixed, reactions: array{active: mixed|null|string, counts: array, palette: mixed}, saved: bool|mixed, can_delete: bool, metadata: array, published_at: string, published_human: string, user: array{id: int|null, name: string, avatar: string, label: string}, comments: array<int, array>, routes: array{like: string, save: string, share: string, repost: string, comment: string, comments: string}, destroy_url: string}
     */
    public static function make(SocialPost $post, ?User $viewer = null, bool $withFallbackMatch = false): array
    {
        $post->loadMissing(['user.candidate', 'user.company', 'profile']);

        $profile = $post->profile;
        $author = $post->user ?? $profile?->resolveOwnerUser();
        $profileType = $profile?->profile_type ?? ($author?->company ? 'company' : 'candidate');
        $authorLabel = match ($profileType) {
            'company' => 'Premium company',
            'mentor' => 'Mentor insight',
            'ally' => 'Ally insight',
            default => 'Candidate insight',
        };

        $matchScore = $post->getAttribute('match_score');
        $matchReasons = $post->getAttribute('match_reasons');

        if ($withFallbackMatch && $matchScore === null) {
            $matchScore = 100;
            $matchReasons = ['Fresh story for your feed'];
        }

        $viewerProfileId = null;
        if ($viewer) {
            $viewerProfileId = $viewer->relationLoaded('socialProfile')
                ? $viewer->socialProfile?->id
                : $viewer->socialProfile()->value('id');
        }

        $liked = false;
        $activeReaction = null;
        if ($viewer) {
            if ($viewerProfileId) {
                if ($post->relationLoaded('likes')) {
                    $match = $post->likes->first(fn ($like) => (int) $like->social_profile_id === (int) $viewerProfileId);
                    if ($match) {
                        $liked = true;
                        $activeReaction = $match->reaction ?? config('social.reactions.default', 'like');
                    }
                } else {
                    $snapshot = $post->likes()
                        ->where('social_profile_id', $viewerProfileId)
                        ->first(['reaction']);
                    if ($snapshot) {
                        $liked = true;
                        $activeReaction = $snapshot->reaction ?? config('social.reactions.default', 'like');
                    }
                }
            } elseif ($post->relationLoaded('likes')) {
                $liked = $post->likes->contains(fn ($like) => (int) $like->user_id === (int) $viewer->id);
            } else {
                $liked = $post->likes()->where('user_id', $viewer->id)->exists();
            }
        }

        $saved = false;
        if ($viewerProfileId) {
            if ($post->relationLoaded('saves')) {
                $saved = $post->saves->contains(fn ($save) => (int) $save->social_profile_id === (int) $viewerProfileId);
            } else {
                $saved = $post->saves()->where('social_profile_id', $viewerProfileId)->exists();
            }
        }

        $replyPreviewLimit = self::replyPreviewLimit();
        $comments = $post->comments()
            ->latest('created_at')
            ->take(5)
            ->with([
                'profile.profileable',
                'replies' => function ($query) use ($replyPreviewLimit) {
                    $query->orderBy('created_at')
                        ->with('profile.profileable')
                        ->take($replyPreviewLimit);
                },
            ])
            ->get()
            ->map(fn (SocialComment $comment) => self::formatComment($comment, $viewer, true))
            ->values()
            ->all();

        $meta = $post->meta ?? [];
        $audienceSkills = array_values(array_filter((array) Arr::get($meta, 'audience.skills', [])));
        $audienceSector = Arr::get($meta, 'audience.sector');
        $matchInsights = Arr::get($meta, 'match_insights');
        $mediaItems = self::prepareMediaItems($post);
        $publishedAt = $post->published_at ?? $post->created_at;
        $aiTags = self::normalizeAiTags($post->ai_tags);
        $aiScore = $post->ai_engagement_score !== null
            ? round((float) $post->ai_engagement_score, 1)
            : null;

        $reactionBreakdown = is_array($post->reaction_breakdown)
            ? $post->reaction_breakdown
            : [];

        return [
            'id' => $post->id,
            'user_id' => $post->user_id,
            'author_type' => $profileType,
            'content' => $post->caption ?? $post->content,
            'tags' => self::stringifyTags($post->tags),
            'media' => $mediaItems,
            'media_type' => self::detectMediaType($mediaItems),
            'audience' => [
                'sector' => $audienceSector,
                'skills' => $audienceSkills,
            ],
            'ai' => [
                'tags' => $aiTags,
                'engagement_score' => $aiScore,
            ],
            'match' => [
                'score' => $matchScore,
                'reasons' => $matchReasons ?? [],
                'insights' => $matchInsights,
            ],
            'counts' => [
                'likes' => (int) ($post->likes_count ?? $post->likes()->count()),
                'comments' => (int) ($post->comments_count ?? $post->comments()->count()),
                'shares' => (int) ($post->shares_count ?? 0),
            ],
            'liked' => $liked,
            'reactions' => [
                'active' => $activeReaction,
                'counts' => $reactionBreakdown,
                'palette' => config('social.reactions.palette', []),
            ],
            'saved' => $saved,
            'can_delete' => $viewer ? (int) $post->user_id === (int) $viewer->id : false,
            'metadata' => $meta,
            'published_at' => optional($publishedAt)->toIso8601String(),
            'published_human' => optional($publishedAt)->diffForHumans(),
            'user' => [
                'id' => $author?->id,
                'name' => $profile?->display_name ?? $author?->name ?? 'Member',
                'avatar' => $profile?->avatar_url ?? self::resolveAvatarForUser($author),
                'label' => $authorLabel,
            ],
            'comments' => $comments,
            'routes' => [
                'like' => route('social.posts.like', $post),
                'save' => route('social.posts.save', $post),
                'share' => route('social.posts.share', $post),
                'repost' => route('social.posts.repost', $post),
                'comment' => route('social.posts.comment', $post),
                'comments' => route('social.posts.comments.index', $post),
            ],
            'destroy_url' => route('social.posts.destroy', $post),
        ];
    }

    /**
     * @return ((array|int|null|string)[]|bool|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, parent_id: int|null, depth: int, content: mixed, published_at: string, published_human: string, counts: array{likes: int, replies: int}, liked: bool|mixed, can_reply: bool, replies: array<int, array>, has_more_replies: bool, user: array{id: int|null, name: string, avatar: string}}
     */
    public static function formatComment(SocialComment $comment, ?User $viewer = null, bool $withReplies = false, int $depth = 0): array
    {
        $comment->loadMissing('profile.profileable');
        $profile = $comment->profile;
        $author = $profile?->resolveOwnerUser();
        $liked = false;

        if ($viewer) {
            $viewerProfileId = $viewer->relationLoaded('socialProfile')
                ? $viewer->socialProfile?->id
                : $viewer->socialProfile()->value('id');

            if ($viewerProfileId) {
                if ($comment->relationLoaded('likes')) {
                    $liked = $comment->likes->contains(
                        fn ($like) => (int) $like->social_profile_id === (int) $viewerProfileId
                    );
                } else {
                    $liked = $comment->likes()->where('social_profile_id', $viewerProfileId)->exists();
                }
            }
        }

        $replyPreviewLimit = self::replyPreviewLimit();
        $replies = [];
        $hasMoreReplies = (int) ($comment->replies_count ?? 0) > 0;

        if ($withReplies) {
            if (! $comment->relationLoaded('replies')) {
                $comment->setRelation(
                    'replies',
                    $comment->replies()
                        ->orderBy('created_at')
                        ->with('profile.profileable')
                        ->take($replyPreviewLimit)
                        ->get()
                );
            }

            $replies = $comment->replies
                ->map(fn (SocialComment $reply) => self::formatComment($reply, $viewer, false, $depth + 1))
                ->values()
                ->all();

            $hasMoreReplies = (int) ($comment->replies_count ?? $comment->replies()->count()) > count($replies);
        }

        return [
            'id' => $comment->id,
            'parent_id' => $comment->parent_id,
            'depth' => $depth,
            'content' => $comment->comment,
            'published_at' => optional($comment->created_at)->toIso8601String(),
            'published_human' => optional($comment->created_at)->diffForHumans(),
            'counts' => [
                'likes' => (int) ($comment->likes_count ?? $comment->likes()->count()),
                'replies' => (int) ($comment->replies_count ?? $comment->replies()->count()),
            ],
            'liked' => $liked,
            'can_reply' => $comment->parent_id === null,
            'replies' => $replies,
            'has_more_replies' => $hasMoreReplies,
            'user' => [
                'id' => $author?->id,
                'name' => $profile?->display_name ?? $author?->name ?? 'Member',
                'avatar' => $profile?->avatar_url ?? self::resolveAvatarForUser($author),
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>|string|null  $media
     */
    public static function detectMediaType(array|string|null $media): ?string
    {
        if ($media === null || $media === '') {
            return null;
        }

        if (is_array($media)) {
            $first = $media[0] ?? null;
            if (is_array($first)) {
                if (! empty($first['type']) && is_string($first['type'])) {
                    return $first['type'];
                }

                if (! empty($first['path']) && is_string($first['path'])) {
                    return self::detectMediaType($first['path']);
                }
            }

            return null;
        }

        $path = parse_url($media, PHP_URL_PATH) ?? '';
        $extension = Str::lower(pathinfo($path, PATHINFO_EXTENSION));

        if (in_array($extension, ['mp4', 'webm', 'ogg', 'mov', 'm4v'], true)) {
            return 'video';
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], true)) {
            return 'image';
        }

        return null;
    }

    public static function resolveAvatarForUser(?User $user): string
    {
        if (! $user) {
            return asset('images/default-avatar.png');
        }

        // 1. Check for uploaded avatar (highest priority)
        if ($user->avatar_path) {
            return $user->avatar_url;
        }

        // 2. Check for candidate/company specific images
        if ($user->candidate && $user->candidate->image) {
            return self::normalizeMediaPath($user->candidate->image);
        }

        if ($user->company && $user->company->logo) {
            return self::normalizeMediaPath($user->company->logo);
        }

        // 3. Fallback to User model logic (handles 'image' field and role-based defaults)
        return $user->avatar_url;
    }

    public static function normalizeMediaPath(string $path): string
    {
        if (Str::startsWith($path, ['http://', 'https://', '//'])) {
            return $path;
        }

        if (Str::startsWith($path, '/storage/')) {
            return $path;
        }

        return SocialMediaStorage::url($path) ?? asset(ltrim($path, '/'));
    }

    private static function prepareMediaItems(SocialPost $post): array
    {

        if ($post->relationLoaded('media')) {
            $mediaRelation = $post->getRelation('media');

            if ($mediaRelation instanceof Collection) {
                $items = $mediaRelation
                    ->filter()
                    ->map(function (SocialMedia $media) {
                        $path = $media->file_path ?? $media->path ?? '';

                        return [
                            'id' => $media->id,
                            'type' => $media->media_type ?? self::detectMediaType($path),
                            'path' => $path ? self::normalizeMediaPath($path) : null,
                            'meta' => $media->ai_analysis ?? [],
                        ];
                    })
                    ->filter(fn ($item) => ! empty($item['path']))
                    ->values()
                    ->all();

                if (! empty($items)) {
                    return $items;
                }
            }
        }

        if (is_array($post->media)) {
            return collect($post->media)
                ->map(function ($media) {
                    $path = is_array($media)
                        ? ($media['path'] ?? $media['file_path'] ?? '')
                        : '';
                    $type = is_array($media) ? ($media['type'] ?? null) : null;

                    return [
                        'id' => is_array($media) ? ($media['id'] ?? null) : null,
                        'type' => $type ?? self::detectMediaType($path),
                        'path' => $path ? self::normalizeMediaPath($path) : null,
                        'meta' => is_array($media) ? ($media['meta'] ?? $media['ai_analysis'] ?? []) : [],
                    ];
                })
                ->filter(fn ($item) => ! empty($item['path']))
                ->values()
                ->all();
        }

        if (is_string($post->media) && $post->media !== '') {
            return [[
                'id' => null,
                'type' => self::detectMediaType($post->media),
                'path' => self::normalizeMediaPath($post->media),
                'meta' => [],
            ]];
        }

        return [];
    }

    private static function stringifyTags(array|null $tags): ?string
    {
        if ($tags === null) {
            return null;
        }

        if (is_string($tags)) {
            return $tags;
        }

        if (is_array($tags)) {
            $normalized = collect($tags)
                ->map(fn ($tag) => is_string($tag) ? Str::of($tag)->trim()->ltrim('#')->toString() : null)
                ->filter()
                ->unique()
                ->map(fn ($tag) => ltrim($tag, '#'))
                ->filter();

            if ($normalized->isEmpty()) {
                return null;
            }

            return $normalized->implode(',');
        }

        return null;
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private static function normalizeAiTags(array|null $tags): array
    {
        if (is_string($tags) && $tags !== '') {
            $tags = array_map('trim', explode(',', $tags));
        }

        if (! is_array($tags)) {
            return [];
        }

        return collect($tags)
            ->map(fn ($tag) => Str::of((string) $tag)->trim()->ltrim('#')->toString())
            ->filter(fn ($tag) => $tag !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @psalm-return int<1, 5>
     */
    private static function replyPreviewLimit(): int
    {
        $limit = (int) config('social.feed.comments.preview_replies', 3);

        if ($limit <= 0) {
            return 3;
        }

        return min($limit, 5);
    }
}

