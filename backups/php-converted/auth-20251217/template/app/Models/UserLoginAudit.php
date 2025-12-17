<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $source
 * @property string|null $timezone
 * @property int|null $offset_minutes
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $logged_in_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Database\Factories\UserLoginAuditFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereIpAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereLoggedInAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereOffsetMinutes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereTimezone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|UserLoginAudit whereUserId($value)
 * @mixin \Eloquent
 */
final class UserLoginAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'source',
        'timezone',
        'offset_minutes',
        'ip_address',
        'user_agent',
        'logged_in_at',
        'meta',
    ];

    protected $casts = [
        'logged_in_at' => 'datetime',
        'meta' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

