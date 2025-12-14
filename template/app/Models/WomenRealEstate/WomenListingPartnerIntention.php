<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerIntentType;
use App\Enums\WomenRealEstate\PartnerIntentionStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int|null $listing_id
 * @property int $initiator_id
 * @property int|null $invitee_id
 * @property PartnerIntentionStatus $status
 * @property PartnerIntentType $intent
 * @property array<array-key, mixed>|null $preferences
 * @property string|null $message
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User $initiator
 * @property-read User|null $invitee
 * @property-read \App\Models\WomenRealEstate\WomenListing|null $listing
 * @method static \Database\Factories\WomenRealEstate\WomenListingPartnerIntentionFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereInitiatorId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereIntent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereInviteeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereMessage($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention wherePreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenListingPartnerIntention whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenListingPartnerIntention extends Model
{
    use HasFactory;

    protected $table = 'women_listing_partner_intentions';

    protected $fillable = [
        'listing_id',
        'initiator_id',
        'invitee_id',
        'status',
        'intent',
        'preferences',
        'message',
        'expires_at',
    ];

    protected $casts = [
        'preferences' => 'array',
        'expires_at' => 'datetime',
        'status' => PartnerIntentionStatus::class,
        'intent' => PartnerIntentType::class,
    ];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_id');
    }

    public function invitee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invitee_id');
    }
}

