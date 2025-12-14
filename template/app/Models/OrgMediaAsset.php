<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $org_page_id
 * @property int|null $uploaded_by
 * @property string $type
 * @property string $disk
 * @property string $original_filename
 * @property string $storage_path
 * @property string|null $processed_path
 * @property string|null $hls_playlist_path
 * @property array<array-key, mixed>|null $stream_variants
 * @property string|null $thumbnail_path
 * @property int|null $duration
 * @property string|null $captions_path
 * @property array<array-key, mixed>|null $safety_labels
 * @property array<array-key, mixed>|null $moderation_labels
 * @property string|null $moderation_status
 * @property string|null $moderation_summary
 * @property array<array-key, mixed>|null $meta
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $transcoded_at
 * @property string|null $processing_errors
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string|null $download_url
 * @property-read bool $is_flagged
 * @property-read string|null $stream_url
 * @property-read string|null $thumbnail_url
 * @property-read string|null $url
 * @property-read \App\Models\OrganizationPage $page
 * @property-read \App\Models\User|null $uploader
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset ready()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset visible()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereCaptionsPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereDuration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereHlsPlaylistPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereModerationLabels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereModerationSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereOriginalFilename($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereProcessedPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereProcessingErrors($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereSafetyLabels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereStoragePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereStreamVariants($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereThumbnailPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereTranscodedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgMediaAsset whereUploadedBy($value)
 *
 * @mixin \Eloquent
 */
final class OrgMediaAsset extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'uploaded_by',
        'type',
        'disk',
        'original_filename',
        'storage_path',
        'processed_path',
        'hls_playlist_path',
        'stream_variants',
        'thumbnail_path',
        'duration',
        'captions_path',
        'safety_labels',
        'meta',
        'status',
        'transcoded_at',
        'processing_errors',
        'moderation_labels',
        'moderation_status',
        'moderation_summary',
    ];

    protected $casts = [
        'safety_labels' => 'array',
        'meta' => 'array',
        'transcoded_at' => 'datetime',
        'stream_variants' => 'array',
        'moderation_labels' => 'array',
    ];

    protected $appends = [
        'url',
        'thumbnail_url',
        'stream_url',
        'download_url',
        'is_flagged',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeReady($query)
    {
        return $query->where('status', 'ready');
    }

    public function scopeVisible($query)
    {
        return $query->ready()->where(function ($visibility) {
            $visibility->whereNull('moderation_status')
                ->orWhereIn('moderation_status', ['approved']);
        });
    }

    public function getUrlAttribute(): ?string
    {
        if ($this->type === 'video') {
            return $this->stream_url ?: $this->download_url;
        }

        $path = $this->processed_path ?: $this->storage_path;

        if (blank($path)) {
            return null;
        }

        return Storage::disk($this->disk)->url($path);
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (blank($this->thumbnail_path)) {
            return null;
        }

        return Storage::disk($this->disk)->url($this->thumbnail_path);
    }

    public function getStreamUrlAttribute(): ?string
    {
        if ($this->type !== 'video' || $this->is_flagged || blank($this->hls_playlist_path)) {
            return null;
        }

        return route('organizations.media.stream', ['media' => $this->id, 'file' => 'master.m3u8']);
    }

    public function getDownloadUrlAttribute(): ?string
    {
        $path = $this->processed_path ?: $this->storage_path;

        if (blank($path)) {
            return null;
        }

        return Storage::disk($this->disk)->url($path);
    }

    public function getIsFlaggedAttribute(): bool
    {
        return Str::of($this->moderation_status)->lower()->value() === 'flagged';
    }
}
