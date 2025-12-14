<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $procurement_opportunity_id
 * @property int|null $mission_brief_id
 * @property string $status
 * @property string|null $motivation
 * @property array<array-key, mixed>|null $availability
 * @property array<array-key, mixed>|null $preferences
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\MissionBrief|null $missionBrief
 * @property-read \App\Models\ProcurementOpportunity $opportunity
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereAvailability($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereMissionBriefId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereMotivation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup wherePreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereProcurementOpportunityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CivicOpportunitySignup whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class CivicOpportunitySignup extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'procurement_opportunity_id',
        'mission_brief_id',
        'status',
        'motivation',
        'availability',
        'preferences',
    ];

    protected $casts = [
        'availability' => 'array',
        'preferences' => 'array',
    ];

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(ProcurementOpportunity::class, 'procurement_opportunity_id');
    }

    public function missionBrief(): BelongsTo
    {
        return $this->belongsTo(MissionBrief::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
