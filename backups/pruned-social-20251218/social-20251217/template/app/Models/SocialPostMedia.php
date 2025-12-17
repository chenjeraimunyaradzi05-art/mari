<?php

namespace App\Models;

/**
 * @property int $id
 * @property int $social_post_id
 * @property string $media_type
 * @property string $path
 * @property string|null $thumbnail_path
 * @property string|null $mime_type
 * @property int|null $file_size
 * @property int|null $width
 * @property int|null $height
 * @property int|null $duration
 * @property int $sort_order
 * @property array<array-key, mixed>|null $ai_analysis
 * @property array<array-key, mixed>|null $filters
 * @property string|null $meta
 * @property int $position
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read bool $is_video
 * @property-read \App\Models\SocialPost $post
 * @property-read string|null $thumbnail_url
 * @property-read string|null $url
 * @method static \Database\Factories\SocialPostMediaFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereAiAnalysis($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereDuration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereFileSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereHeight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereMimeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia wherePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia wherePosition($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereThumbnailPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostMedia whereWidth($final value)
 * @mixin \Eloquent
 */
final class SocialPostMedia extends SocialMedia
{
}
