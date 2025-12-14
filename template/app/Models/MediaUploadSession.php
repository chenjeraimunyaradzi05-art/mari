<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $user_id
 * @property string $status
 * @property string $scan_status
 * @property string|null $scan_verdict
 * @property int|null $scan_score
 * @property array<array-key, mixed>|null $scan_labels
 * @property string|null $scan_summary
 * @property Carbon|null $scan_attempted_at
 * @property Carbon|null $scan_completed_at
 * @property string|null $scan_error
 * @property string $media_type
 * @property string|null $mime_type
 * @property string $storage_disk
 * @property string|null $storage_path
 * @property string $chunk_disk
 * @property int $total_size
 * @property int $uploaded_size
 * @property int $chunk_size
 * @property int $total_chunks
 * @property int $received_chunks
 * @property string|null $checksum
 * @property string|null $role_quota_key
 * @property array<array-key, mixed>|null $meta
 * @property string|null $thumbnail_path
 * @property Carbon|null $completed_at
 * @property Carbon|null $expires_at
 * @property string|null $error_message
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MediaUploadChunk> $chunks
 * @property int|null chunks_count
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereChecksum($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereChunkDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereChunkSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereMimeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereReceivedChunks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereRoleQuotaKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanAttemptedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanError($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanLabels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereScanVerdict($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereStorageDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereStoragePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereThumbnailPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereTotalChunks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereTotalSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereUploadedSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadSession whereUuid($value)
 *
 * @mixin \Eloquent
 */
final class MediaUploadSession extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_UPLOADING = 'uploading';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'user_id',
        'status',
        'media_type',
        'mime_type',
        'storage_disk',
        'storage_path',
        'chunk_disk',
        'total_size',
        'uploaded_size',
        'chunk_size',
        'total_chunks',
        'received_chunks',
        'checksum',
        'role_quota_key',
        'meta',
        'thumbnail_path',
        'completed_at',
        'expires_at',
        'error_message',
        'scan_status',
        'scan_verdict',
        'scan_score',
        'scan_labels',
        'scan_summary',
        'scan_attempted_at',
        'scan_completed_at',
        'scan_error',
    ];

    protected $casts = [
        'meta' => 'array',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
        'total_size' => 'int',
        'uploaded_size' => 'int',
        'chunk_size' => 'int',
        'total_chunks' => 'int',
        'received_chunks' => 'int',
        'scan_labels' => 'array',
        'scan_attempted_at' => 'datetime',
        'scan_completed_at' => 'datetime',
        'scan_score' => 'int',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (MediaUploadSession $session): void {
            if (empty($session->uuid)) {
                $session->uuid = (string) Str::uuid();
            }

            if (empty($session->expires_at)) {
                $session->expires_at = Carbon::now()->addMinutes((int) config('social.uploads.session_ttl_minutes', 180));
            }
        });
    }

    /**
     * @psalm-return 'uuid'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(MediaUploadChunk::class);
    }

    public function isComplete(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function markStatus(string $status): void
    {
        $this->forceFill(['status' => $status])->save();
    }

    /**
     * @return (array|int|string)[]
     *
     * @psalm-return array<string, array|int|string>
     */
    public function toAttachmentPayload(): array
    {
        return array_filter([
            'path' => $this->storage_path,
            'disk' => $this->storage_disk,
            'thumbnail_path' => $this->thumbnail_path,
            'mime_type' => $this->mime_type,
            'type' => $this->media_type,
            'file_size' => $this->total_size,
            'meta' => $this->meta,
        ], fn ($value) => $value !== null && $value !== []);
    }
}
