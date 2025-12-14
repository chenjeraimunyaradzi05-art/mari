<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string|null $auditable_type
 * @property int|null $auditable_id
 * @property string $action
 * @property array<array-key, mixed>|null $meta
 * @property string|null $actor_ip
 * @property string|null $actor_user_agent
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Model|\Eloquent|null $auditable
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereActorIp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereActorUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereAuditableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereAuditableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereRecordedAtfinal ($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ComplianceAudit whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ComplianceAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'auditable_type',
        'auditable_id',
        'action',
        'meta',
        'actor_ip',
        'actor_user_agent',
        'recorded_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'recorded_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }
}
