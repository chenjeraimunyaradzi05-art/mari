<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $media_upload_session_id
 * @property int $chunk_index
 * @property int $size
 * @property string|null $checksum
 * @property string $storage_path
 * @property \Illuminate\Support\Carbon|null $uploaded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\MediaUploadSession $session
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereChecksum($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereChunkIndex($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereMediaUploadSessionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereStoragePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MediaUploadChunk whereUploadedAt($value)
 *
 * @mixin \Eloquent
 */
final class MediaUploadChunk extends Model
{
    use HasFactory;

    protected $fillable = [
        'media_upload_session_id',
        'chunk_index',
        'size',
        'checksum',
        'storage_path',
        'uploaded_at',
    ];

    protected $casts = [
        'uploaded_at' => 'datetime',
        'chunk_index' => 'int',
        'size' => 'int',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(MediaUploadSession::class, 'media_upload_session_id');
    }
}
