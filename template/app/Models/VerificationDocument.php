<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $verification_id
 * @property string $disk
 * @property string $path
 * @property string|null $mime_type
 * @property int|null $size_bytes
 * @property string|null $checksum
 * @property string|null $redacted_preview_path
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\ProfileVerification $verification
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereChecksum($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereMimeType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument wherePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereRedactedPreviewPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereSizeBytes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VerificationDocument whereVerificationId($value)
 * @mixin \Eloquent
 */
final class VerificationDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'verification_id',
        'disk',
        'path',
        'mime_type',
        'size_bytes',
        'checksum',
        'redacted_preview_path',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function verification(): BelongsTo
    {
        return $this->belongsTo(ProfileVerification::class, 'verification_id');
    }
}

