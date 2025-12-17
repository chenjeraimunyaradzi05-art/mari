<?php

namespace App\Support;

use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Support\SocialPostFormatter;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class SocialReels
{
    /**
     * @return (mixed|null|string)[][]
     *
     * @psalm-return array<int, array{id: mixed, media: mixed|null, media_type: mixed|null, author: mixed, avatar: mixed, caption: string, published_at: mixed, published_human: mixed, match_score: mixed}>
     */
    public static function fromCollection(Collection $posts, int $limit = 12): array
    {
        return $posts
            ->filter(fn (SocialPost $post) => self::postHasVideo($post))
            ->values()
            ->take($limit)
            ->map(function (SocialPost $post) {
                $payload = SocialPostFormatter::make($post, null, true);
                $media = $payload['media'][0] ?? null;

                return [
                    'id' => $payload['id'],
                    'media' => $media['path'] ?? null,
                    'media_type' => $media['type'] ?? $payload['media_type'],
                    'author' => $payload['user']['name'],
                    'avatar' => $payload['user']['avatar'],
                    'caption' => Str::limit((string) $payload['content'], 160),
                    'published_at' => $payload['published_at'],
                    'published_human' => $payload['published_human'],
                    'match_score' => $payload['match']['score'],
                ];
            })
            ->filter(fn (array $item) => $item['media'] !== null)
            ->values()
            ->all();
    }

    private static function postHasVideo(SocialPost $post): bool
    {
        if ($post->relationLoaded('media')) {
            $mediaRelation = $post->getRelationValue('media');

            if ($mediaRelation instanceof Collection) {
                return $mediaRelation->contains(function (SocialMedia $media) {
                    $path = $media->file_path ?? $media->path;

                    return ($media->media_type ?? SocialPostFormatter::detectMediaType($path)) === 'video';
                });
            }
        }

        $mediaAttribute = $post->getAttribute('media');

        if (is_array($mediaAttribute)) {
            foreach ($mediaAttribute as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $type = $item['type'] ?? null;
                $path = $item['path'] ?? $item['file_path'] ?? null;

                if (($type ?? SocialPostFormatter::detectMediaType($path)) === 'video') {
                    return true;
                }
            }

            return false;
        }

        if (is_string($mediaAttribute) && $mediaAttribute !== '') {
            return SocialPostFormatter::detectMediaType($mediaAttribute) === 'video';
        }

        return $post->media()->where('media_type', 'video')->exists();
    }
}

