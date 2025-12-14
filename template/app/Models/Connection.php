<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $connected_user_id
 * @property string $status
 * @property string|null $type
 * @property int|null $initiator_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $connectedUser
 * @property-read \App\Models\User|null $initiator
 * @property-read \App\Models\User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection accepted()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection blocked()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection pending()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection rejected()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereConnectedUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereInitiatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Connection snoozed()
 *
 * @mixin \Eloquent
 */
final class Connection extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_SNOOZED = 'snoozed';

    public const STATUS_BLOCKED = 'blocked';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'connected_user_id',
        'status',
        'type',
        'initiator_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user who initiated/owns the connection.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the user who is connected to.
     */
    public function connectedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_user_id');
    }

    /**
     * Get the user who initiated the connection request.
     */
    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_id');
    }

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (Connection $connection) {
            if (! in_array($connection->status, self::allowedStatuses(), true)) {
                $connection->status = self::STATUS_PENDING;
            }
        });

        self::updating(function (Connection $connection) {
            if (! in_array($connection->status, self::allowedStatuses(), true)) {
                throw new \InvalidArgumentException('Invalid connection status.');
            }
        });
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'pending', 'accepted', 'snoozed', 'blocked', 'rejected'}
     */
    public static function allowedStatuses(): array
    {
        return [
            self::STATUS_PENDING,
            self::STATUS_ACCEPTED,
            self::STATUS_SNOOZED,
            self::STATUS_BLOCKED,
            self::STATUS_REJECTED,
        ];
    }

    /**
     * Scope to get pending connection requests.
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope to get accepted connections.
     */
    public function scopeAccepted($query)
    {
        return $query->where('status', self::STATUS_ACCEPTED);
    }

    /**
     * Scope to get rejected connections.
     */
    public function scopeRejected($query)
    {
        return $query->where('status', self::STATUS_REJECTED);
    }

    /**
     * Scope to get blocked connections.
     */
    public function scopeBlocked($query)
    {
        return $query->where('status', self::STATUS_BLOCKED);
    }

    public function scopeSnoozed($query)
    {
        return $query->where('status', self::STATUS_SNOOZED);
    }

    /**
     * Accept a connection request.
     */
    public function accept(): void
    {
        $this->update(['status' => self::STATUS_ACCEPTED]);
    }

    /**
     * Reject a connection request.
     */
    public function reject(): void
    {
        $this->update(['status' => self::STATUS_REJECTED]);
    }

    /**
     * Block a connection.
     */
    public function block(): void
    {
        $this->update(['status' => self::STATUS_BLOCKED]);
    }

    public function snooze(): void
    {
        $this->update(['status' => self::STATUS_SNOOZED]);
    }

    /**
     * Check if connection is pending.
     */
    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /**
     * Check if connection is accepted.
     */
    public function isAccepted(): bool
    {
        return $this->status === self::STATUS_ACCEPTED;
    }
}
