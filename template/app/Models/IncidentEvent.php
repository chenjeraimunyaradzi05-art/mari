<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $incident_id
 * @property int|null $author_user_id
 * @property string $action
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $author
 * @property-read \App\Models\IncidentReport $incident
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereAuthorUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereIncidentId($value)
 * @method static \Illuminate\Database\\Eloquent\Builder<static>|IncidentEvent whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentEvent whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class IncidentEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'incident_id',
        'author_user_id',
        'action',
        'notes',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(IncidentReport::class, 'incident_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
