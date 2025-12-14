<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $listing_partnership_intention_id
 * @property int $counterparty_user_id
 * @property float|null $match_score
 * @property string|null $ai_explanation
 * @property string $status
 * @property string|null $action_required_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $counterparty
 * @property-read \App\Models\ListingPartnershipIntention $intention
 *
 * @method static \Database\Factories\PartnershipMatchFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereActionRequiredBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereAiExplanation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereCounterpartyUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereListingPartnershipIntentionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereMatchScore($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PartnershipMatch whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class PartnershipMatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'listing_partnership_intention_id',
        'counterparty_user_id',
        'match_score',
        'ai_explanation',
        'status',
        'action_required_by',
    ];

    protected $casts = [
        'match_score' => 'float',
    ];

    public function intention(): BelongsTo
    {
        return $this->belongsTo(ListingPartnershipIntention::class, 'listing_partnership_intention_id');
    }

    public function counterparty(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counterparty_user_id');
    }
}
