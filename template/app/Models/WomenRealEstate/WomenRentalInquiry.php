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
 * @property int $rental_property_id
 * @property int $property_seeker_id
 * @property int $landlord_user_id
 * @property string $inquiry_message
 * @property string $status
 * @property int $priority_score
 * @property \Illuminate\Support\Carbon|null $responded_at
 * @property string|null $landlord_response
 * @property \Illuminate\Support\Carbon|null $scheduled_tour_at
 * @property \Illuminate\Support\Carbon|null $tour_completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read User $landlord
 * @property-read \App\Models\WomenRealEstate\WomenRentalProperty $rentalProperty
 * @property-read \App\Models\WomenRealEstate\WomenPropertySeeker|null $seeker
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereInquiryMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereLandlordResponse($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereLandlordUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry wherePriorityScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry wherePropertySeekerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereRentalPropertyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereRespondedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereScheduledTourAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry whereTourCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builderfinal <static>|WomenRentalInquiry whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenRentalInquiry withoutTrashed()
 * @mixin \Eloquent
 */
final class WomenRentalInquiry extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'women_rental_inquiries';

    protected $fillable = [
        'rental_property_id',
        'property_seeker_id',
        'landlord_user_id',
        'inquiry_message',
        'status',
        'priority_score',
        'responded_at',
        'landlord_response',
        'scheduled_tour_at',
        'tour_completed_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'scheduled_tour_at' => 'datetime',
        'tour_completed_at' => 'datetime',
    ];

    public function rentalProperty(): BelongsTo
    {
        return $this->belongsTo(WomenRentalProperty::class);
    }

    public function seeker(): BelongsTo
    {
        return $this->belongsTo(WomenPropertySeeker::class);
    }

    public function landlord(): BelongsTo
    {
        return $this->belongsTo(User::class, 'landlord_user_id');
    }
}
