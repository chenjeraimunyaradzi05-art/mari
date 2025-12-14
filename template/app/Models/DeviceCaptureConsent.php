<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $capture_type
 * @property string|null $context
 * @property string|null $consent_copy
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $reminded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereCaptureType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereConsentCopy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereIpAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereRemindedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DeviceCaptureConsent whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class DeviceCaptureConsent extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'capture_type',
        'context',
        'consent_copy',
        'ip_address',
        'user_agent',
        'reminded_at',
    ];

    protected $casts = [
        'reminded_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
