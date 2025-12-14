<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property int $vehicle_listing_id
 * @property int $dealer_id
 * @property string $message
 * @property string $inquiry_type
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Dealer $dealer
 * @property-read \App\Models\User $user
 * @property-read \App\Models\VehicleListing $vehicleListing
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereDealerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereInquiryType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\\Builder<static>|VehicleInquiry whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleInquiry whereVehicleListingId($value)
 * @mixin \Eloquent
 */
final class VehicleInquiry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'vehicle_listing_id',
        'dealer_id',
        'message',
        'inquiry_type',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehicleListing(): BelongsTo
    {
        return $this->belongsTo(VehicleListing::class);
    }

    public function dealer(): BelongsTo
    {
        return $this->belongsTo(Dealer::class);
    }
}

