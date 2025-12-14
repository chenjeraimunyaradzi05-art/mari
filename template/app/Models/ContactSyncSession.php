<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $provider
 * @property string $status
 * @property string $state_token
 * @property string|null $auth_url
 * @property int $synced_contacts_count
 * @property array<array-key, mixed>|null $error_payload
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ContactSyncContact> $contacts
 * @property int|null contacts_count
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession active()
 * @method static \Database\Factories\ContactSyncSessionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereAuthUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereErrorPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereStateToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereSyncedContactsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ContactSyncSession whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ContactSyncSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'provider',
        'status',
        'state_token',
        'auth_url',
        'synced_contacts_count',
        'error_payload',
        'started_at',
        'completed_at',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'error_payload' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ContactSyncContact::class, 'session_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
