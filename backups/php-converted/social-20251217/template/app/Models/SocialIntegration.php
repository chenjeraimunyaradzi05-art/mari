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
 * @property array<array-key, mixed>|null $scopes
 * @property array<array-key, mixed>|null $tokens
 * @property array<array-key, mixed>|null $settings
 * @property \Illuminate\Support\Carbon|null $connected_at
 * @property \Illuminate\Support\Carbon|null $last_synced_at
 * @property \Illuminate\Support\Carbon|null $last_imported_at
 * @property string|null $last_error
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialImportJob> $importJobs
 * @property int|null import_jobs_count
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\SocialIntegrationFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereConnectedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereLastError($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereLastImportedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereLastSyncedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereScopes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereSettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereTokens($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIntegration whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialIntegration extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'provider',
        'status',
        'scopes',
        'tokens',
        'settings',
        'connected_at',
        'last_synced_at',
        'last_imported_at',
        'last_error',
    ];

    protected $casts = [
        'scopes' => 'array',
        'tokens' => 'array',
        'settings' => 'array',
        'connected_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'last_imported_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function importJobs(): HasMany
    {
        return $this->hasMany(SocialImportJob::class);
    }
}

