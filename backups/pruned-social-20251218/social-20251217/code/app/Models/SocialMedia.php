<?php

namespace App\Models;

use App\Support\SocialMediaStorage;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $social_post_id
 * @property string $media_type
 * @property string $file_path
 * @property string|null $thumbnail_path
 * @property string $mime_type
 * @property int|null $file_size
 * @property int|null $width
 * @property int|null $height
 * @property int|null $duration
 * @property int $order
 * @property array<array-key, mixed>|null $ai_analysis
 * @property array<array-key, mixed>|null $filters
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read bool $is_video
 * @property-read \App\Models\SocialPost $post
 * @property-read string|null $thumbnail_url
 * @property-read string|null $url
 * @method static \Database\Factories\SocialMediaFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereAiAnalysis($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereDuration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereFileSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereHeight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereMimeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereThumbnailPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMedia whereWidth($value)
 * @mixin \Eloquent
 */
class SocialMedia extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'media_type',
        'file_path',
        'thumbnail_path',
        'mime_type',
        'file_size',
        'width',
        'height',
        'duration',
        'order',
        'ai_analysis',
        'filters',
    ];

    protected $casts = [
        'ai_analysis' => 'array',
        'filters' => 'array',
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'duration' => 'integer',
        'order' => 'integer',
    ];

    protected $appends = [
        'url',
        'thumbnail_url',
        'is_video',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    protected function url(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->resolveMediaPath($this->file_path));
    }

    protected function thumbnailUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->resolveMediaPath($this->thumbnail_path));
    }

    protected function isVideo(): Attribute
    {
        return Attribute::get(function (): bool {
            if ($this->media_type) {
                return $this->media_type === 'video';
            }

            return $this->detectMediaType($this->file_path) === 'video';
        });
    }

    private function resolveMediaPath(?string $path): ?string
    {
        return SocialMediaStorage::url($path);
    }

    private function detectMediaType(?string $path): string|null
    {
        if (! $path) {
            return null;
        }

        $candidate = parse_url($path, PHP_URL_PATH) ?: $path;
        $extension = Str::lower(pathinfo($candidate, PATHINFO_EXTENSION));

        if ($extension === '') {
            return null;
        }

        if (in_array($extension, ['mp4', 'webm', 'ogg', 'mov', 'm4v'], true)) {
            return 'video';
        }

        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'], true)) {
            return 'image';
        }

        return null;
    }
}
