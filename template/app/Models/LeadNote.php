<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $lead_id
 * @property int $user_id
 * @property string $body
 * @property bool $is_system
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $author
 * @property-read \App\Models\Lead $lead
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereIsSystem($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereLeadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereMetadata($value)
 * @method static \Illuminate\\Database\Eloquent\Builder<static>|LeadNote whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LeadNote whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class LeadNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'lead_id',
        'user_id',
        'body',
        'is_system',
        'metadata',
    ];

    protected $casts = [
        'is_system' => 'boolean',
        'metadata' => 'array',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
