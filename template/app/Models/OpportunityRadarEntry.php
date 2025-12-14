<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $opportunity_type
 * @property int|null $opportunity_id
 * @property string $title
 * @property string|null $subtitle
 * @property string|null $summary
 * @property int $score
 * @property string $urgency_level
 * @property array<array-key, mixed>|null $fit_reasons
 * @property string|null $action_url
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $notified_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\OpportunityRadarEntryFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereActionUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereFitReasons($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereNotifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereOpportunityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereOpportunityType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereSubtitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereUrgencyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OpportunityRadarEntry whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class OpportunityRadarEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'opportunity_type',
        'opportunity_id',
        'title',
        'subtitle',
        'summary',
        'score',
        'urgency_level',
        'fit_reasons',
        'action_url',
        'expires_at',
        'notified_at',
    ];

    protected $casts = [
        'fit_reasons' => 'array',
        'expires_at' => 'datetime',
        'notified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
