<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $women_housing_listing_id
 * @property int $initiator_user_id
 * @property string $intent_type
 * @property int|null $budget_range_min_cents
 * @property int|null $budget_range_max_cents
 * @property string|null $preferred_finance_type
 * @property array<array-key, mixed>|null $skills_offered
 * @property string|null $availability_window
 * @property string $status
 * @property string|null $ai_match_vector
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $initiator
 * @property-read \App\Models\WomenHousingListing $listing
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PartnershipMatch> $matches
 * @property int|null matches_count
 *
 * @method static Builder<static>|ListingPartnershipIntention active()
 * @method static \Database\Factories\ListingPartnershipIntentionFactory factory($count = null, $state = [])
 * @method static Builder<static>|ListingPartnershipIntention newModelQuery()
 * @method static Builder<static>|ListingPartnershipIntention newQuery()
 * @method static Builder<static>|ListingPartnershipIntention query()
 * @method static Builder<static>|ListingPartnershipIntention whereAiMatchVector($value)
 * @method static Builder<static>|ListingPartnershipIntention whereAvailabilityWindow($value)
 * @method static Builder<static>|ListingPartnershipIntention whereBudgetRangeMaxCents($value)
 * @method static Builder<static>|ListingPartnershipIntention whereBudgetRangeMinCents($value)
 * @method static Builder<static>|ListingPartnershipIntention whereCreatedAt($value)
 * @method static Builder<static>|ListingPartnershipIntention whereId($value)
 * @method static Builder<static>|ListingPartnershipIntention whereInitiatorUserId($value)
 * @method static Builder<static>|ListingPartnershipIntention whereIntentType($value)
 * @method static Builder<static>|ListingPartnershipIntention whereNotes($value)
 * @method static Builder<static>|ListingPartnershipIntention wherePreferredFinanceType($value)
 * @method static Builder<static>|ListingPartnershipIntention whereSkillsOffered($value)
 * @method static Builder<static>|ListingPartnershipIntention whereStatus($value)
 * @method static Builder<static>|ListingPartnershipIntention whereUpdatedAt($value)
 * @method static Builder<static>|ListingPartnershipIntention whereWomenHousingListingId($value)
 *
 * @mixin \Eloquent
 */
final class ListingPartnershipIntention extends Model
{
    use HasFactory;

    protected $fillable = [
        'women_housing_listing_id',
        'initiator_user_id',
        'intent_type',
        'budget_range_min_cents',
        'budget_range_max_cents',
        'preferred_finance_type',
        'skills_offered',
        'availability_window',
        'status',
        'ai_match_vector',
        'notes',
    ];

    protected $casts = [
        'skills_offered' => 'array',
        'budget_range_min_cents' => 'integer',
        'budget_range_max_cents' => 'integer',
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenHousingListing::class, 'women_housing_listing_id');
    }

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_user_id');
    }

    public function matches(): HasMany
    {
        return $this->hasMany(PartnershipMatch::class, 'listing_partnership_intention_id');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', ['pending', 'matched']);
    }
}
