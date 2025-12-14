<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $property_seeker_id
 * @property int|null $rental_property_id
 * @property int|null $listing_id
 * @property int|null $landlord_user_id
 * @property numeric $match_score 0-100 match percentage
 * @property array<array-key, mixed>|null $match_reasons
 * @property array<array-key, mixed>|null $match_breakdown
 * @property string $match_status
 * @property \Illuminate\Support\Carbon|null $viewed_at
 * @property \Illuminate\Support\Carbon|null $inquired_at
 * @property string|null $seeker_note
 * @property int|null $relevance_rank
 * @property bool $is_ai_recommended
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read User|null $landlord
 * @property-read \App\Models\WomenRealEstate\WomenListing|null $listing
 * @property-read \App\Models\WomenRealEstate\WomenRentalProperty|null $rentalProperty
 * @property-read \App\Models\WomenRealEstate\WomenPropertySeeker|null $seeker
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereInquiredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereIsAiRecommended($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereLandlordUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereMatchBreakdown($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereMatchReasons($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereMatchScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereMatchStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch wherePropertySeekerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereRelevanceRank($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereRentalPropertyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereSeekerNote($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch whereViewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPropertyMatch withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenPropertyMatch extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'women_property_matches';

    protected $fillable = [
        'property_seeker_id',
        'rental_property_id',
        'listing_id',
        'landlord_user_id',
        'match_score',
        'match_reasons',
        'match_breakdown',
        'match_status',
        'viewed_at',
        'inquired_at',
        'seeker_note',
        'relevance_rank',
        'is_ai_recommended',
    ];

    protected $casts = [
        'match_score' => 'decimal:2',
        'match_reasons' => 'json',
        'match_breakdown' => 'json',
        'viewed_at' => 'datetime',
        'inquired_at' => 'datetime',
        'is_ai_recommended' => 'boolean',
    ];

    public function seeker(): BelongsTo
    {
        return $this->belongsTo(WomenPropertySeeker::class);
    }

    public function rentalProperty(): BelongsTo
    {
        return $this->belongsTo(WomenRentalProperty::class);
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class);
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_user_id');
    }
}

