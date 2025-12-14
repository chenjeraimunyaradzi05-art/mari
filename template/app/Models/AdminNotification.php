<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $admin_id
 * @property string $type
 * @property array<array-key, mixed>|null $data
 * @property \Illuminate\Support\Carbon|null $read_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Admin $admin
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification unread()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereAdminId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereReadAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdminNotification whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AdminNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_id',
        'type',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    public function markAsRead(): void
    {
        if ($this->read_at) {
            return;
        }

        $this->forceFill(['read_at' => now()])->save();
    }
}
