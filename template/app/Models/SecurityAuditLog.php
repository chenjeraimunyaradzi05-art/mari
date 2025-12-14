<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $event_type
 * @property string $severity
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $resource_type
 * @property string|null $resource_id
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $exported_at
 * @property string|null $export_batch_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereEventType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereExportBatchId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereExportedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereIpAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereResourceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereResourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SecurityAuditLog whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class SecurityAuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'event_type',
        'severity',
        'ip_address',
        'user_agent',
        'resource_type',
        'resource_id',
        'metadata',
        'exported_at',
        'export_batch_id',
    ];

    protected $casts = [
        'metadata' => 'array',
        'exported_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
