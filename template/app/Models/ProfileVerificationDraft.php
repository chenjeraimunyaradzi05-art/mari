<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $profile_id
 * @property int $user_id
 * @property string|null $current_step
 * @property array<array-key, mixed>|null $payload
 * @property array<array-key, mixed>|null $document_manifest
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Profile $profile
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereCurrentStep($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereDocumentManifest($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerificationDraft whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ProfileVerificationDraft extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'user_id',
        'current_step',
        'payload',
        'document_manifest',
        'expires_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'document_manifest' => 'array',
        'expires_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
