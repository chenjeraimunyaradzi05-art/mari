<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $public_sector_opportunity_id
 * @property string $engagement_type
 * @property array<array-key, mixed>|null $channels
 * @property string|null $motivation
 * @property string|null $ai_summary
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\PublicSectorOpportunity|null $opportunity
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereAiSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereChannels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereEngagementType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereMotivation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement wherePublicSectorOpportunityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorEngagement whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class PublicSectorEngagement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'public_sector_opportunity_id',
        'engagement_type',
        'channels',
        'motivation',
        'ai_summary',
        'submitted_at',
    ];

    protected $casts = [
        'channels' => 'array',
        'submitted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(PublicSectorOpportunity::class, 'public_sector_opportunity_id');
    }
}
