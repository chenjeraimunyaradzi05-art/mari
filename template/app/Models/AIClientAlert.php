<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $source
 * @property string $severity
 * @property string $message
 * @property array<array-key, mixed>|null $context
 * @property int|null $admin_id
 * @property string|null $ip
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $received_at
 * @property \Illuminate\Support\Carbon|null $acknowledged_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Database\Factories\AIClientAlertFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert severity(?array $levels)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereAcknowledgedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereAdminId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereIp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereReceivedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AIClientAlert whereUserAgent($value)
 *
 * @mixin \Eloquent
 */
final class AIClientAlert extends Model
{
    use HasFactory;

    protected $table = 'ai_client_alerts';

    protected $fillable = [
        'source',
        'severity',
        'message',
        'context',
        'admin_id',
        'ip',
        'user_agent',
        'received_at',
        'acknowledged_at',
    ];

    protected $casts = [
        'context' => 'array',
        'received_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function scopeSeverity($query, ?array $levels)
    {
        if (empty($levels)) {
            return $query;
        }

        return $query->whereIn('severity', $levels);
    }
}
