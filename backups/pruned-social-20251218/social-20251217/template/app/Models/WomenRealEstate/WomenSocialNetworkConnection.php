<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id_1
 * @property int $user_id_2
 * @property string $connection_type
 * @property string $status
 * @property string|null $message
 * @property \Illuminate\Support\Carbon|null $connected_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read User $initiator
 * @property-read User $recipient
 * @method static \Database\Factories\WomenRealEstate\WomenSocialNetworkConnectionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereConnectedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereConnectionType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereUserId1($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection whereUserId2($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenSocialNetworkConnection withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenSocialNetworkConnection extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'women_social_network_connections';

    protected $fillable = [
        'user_id_1',
        'user_id_2',
        'connection_type',
        'status',
        'message',
        'connected_at',
    ];

    protected $casts = [
        'connected_at' => 'datetime',
    ];

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id_1');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id_2');
    }
}

