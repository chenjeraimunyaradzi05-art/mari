<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $social_message_id
 * @property int $uploaded_by_social_profile_id
 * @property string $media_type
 * @property string|null $storage_disk
 * @property string $file_path
 * @property string|null $thumbnail_path
 * @property string|null $mime_type
 * @property int|null $file_size
 * @property int|null $width
 * @property int|null $height
 * @property int|null $duration
 * @property string|null $mediaable_type
 * @property int|null $mediaable_id
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent|null $mediaable
 * @property-read \App\Models\SocialMessage $message
 * @property-read \App\Models\SocialProfile $uploader
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereDuration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereFileSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereHeight($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereMediaableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereMediaableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereMimeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereSocialMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereStorageDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereThumbnailPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereUploadedBySocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageAttachment whereWidth($value)
 * @mixin \Eloquent
 */
final class SocialMessageAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_message_id',
        'uploaded_by_social_profile_id',
        'media_type',
        'storage_disk',
        'file_path',
        'thumbnail_path',
        'mime_type',
        'file_size',
        'width',
        'height',
        'duration',
        'mediaable_type',
        'mediaable_id',
        'meta',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'duration' => 'integer',
        'meta' => 'array',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SocialMessage::class, 'social_message_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'uploaded_by_social_profile_id');
    }

    public function mediaable(): MorphTo
    {
        return $this->morphTo();
    }
}

