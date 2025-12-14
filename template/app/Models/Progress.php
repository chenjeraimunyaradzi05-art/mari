<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $type
 * @property int $value
 * @property int $target
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereTarget($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereUserId(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Progress whereValue($value)
 *
 * @mixin \Eloquent
 */
final class Progress extends Model
{
    protected $fillable = [
        'user_id', 'type', 'value', 'target', 'completed_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
