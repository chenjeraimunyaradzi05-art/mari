<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $actor_id
 * @property int|null $target_user_id
 * @property int|null $connection_id
 * @property string $action
 * @property string|null $status
 * @property array<array-key, mixed>|null $context
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $actor
 * @property-read \App\Models\Connection|null $connection
 * @property-read \App\Models\User|null $target
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereActorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereConnectionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereTargetUserId($value)
 *
 * @final method static \Illuminate\Database\Eloquent\Builder<static>|ConnectionActivityLog whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class ConnectionActivityLog extends Model
{
    protected $fillable = [
        'actor_id',
        'target_user_id',
        'connection_id',
        'action',
        'status',
        'context',
    ];

    protected $casts = [
        'context' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(Connection::class);
    }
}
