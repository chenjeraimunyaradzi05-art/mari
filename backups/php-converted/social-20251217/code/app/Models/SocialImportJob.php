<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $social_integration_id
 * @property string $provider
 * @property string $type
 * @property string $status
 * @property array<array-key, mixed>|null $payload
 * @property array<array-key, mixed>|null $result
 * @property string|null $error_message
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialIntegration|null $integration
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereErrorMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereResult($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereSocialIntegrationId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialImportJob whereUserId($value)
 * @mixin \Eloquent
 */
final class SocialImportJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'social_integration_id',
        'provider',
        'type',
        'status',
        'payload',
        'result',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'result' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(SocialIntegration::class, 'social_integration_id');
    }
}

