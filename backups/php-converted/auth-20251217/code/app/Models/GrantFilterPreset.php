<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $persona_key
 * @property string $name
 * @property array $filters
 * @property bool $notify_in_app
 * @property bool $notify_email
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\GrantFilterPresetFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset forPersona(\App\Models\User $user, string $personaKey)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereNotifyEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereNotifyInApp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset wherePersonaKey($value)
 * @method static \\Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantFilterPreset whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class GrantFilterPreset extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'persona_key',
        'name',
        'filters',
        'notify_in_app',
        'notify_email',
    ];

    protected $casts = [
        'filters' => 'array',
        'notify_in_app' => 'boolean',
        'notify_email' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForPersona($query, User $user, string $personaKey)
    {
        return $query->where('user_id', $user->id)
            ->where('persona_key', $personaKey);
    }
}
