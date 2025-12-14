<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property int|null $user_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $device_name
 * @property string|null $device_type
 * @property string|null $browser
 * @property string|null $platform
 * @property string|null $location_city
 * @property string|null $location_country
 * @property \Illuminate\Support\Carbon|null $last_activity
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereBrowser($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereDeviceName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereDeviceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereIpAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereLastActivity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereLocationCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereLocationCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended wherePlatform($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SessionExtended whereUserId($value)
 * @mixin \Eloquent
 */
final class SessionExtended extends Model
{
    use HasFactory;

    protected $table = 'sessions_extended';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'ip_address',
        'user_agent',
        'device_name',
        'device_type',
        'browser',
        'platform',
        'location_city',
        'location_country',
        'last_activity',
    ];

    protected $casts = [
        'last_activity' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

