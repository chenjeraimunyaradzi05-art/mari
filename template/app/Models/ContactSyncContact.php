<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $session_id
 * @property int $user_id
 * @property string $hash
 * @property string $type
 * @property int|null $matched_user_id
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $matchedUser
 * @property-read \App\Models\User $owner
 * @property-read \App\Models\ContactSyncSession $session
 *
 * @method static \Database\Factories\ContactSyncContactFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereMatchedUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereSessionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncContact whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ContactSyncContact extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'user_id',
        'hash',
        'type',
        'matched_user_id',
        'metadata',
        'expires_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'expires_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ContactSyncSession::class, 'session_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function matchedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_user_id');
    }
}
