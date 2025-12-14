<?php

namespace App\Models;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $service_listing_id
 * @property int|null $user_id
 * @property int|null $lead_id
 * @property string|null $contact_name
 * @property string|null $contact_email
 * @property string|null $contact_phone
 * @property string $source
 * @property string $status
 * @property string|null $notes
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read Lead|null $lead
 * @property-read \App\Models\ServiceListing $listing
 * @property-read \App\Models\User|null $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereContactEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereContactName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereContactPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereLeadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereServiceListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLeadwhereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ServiceListingLead whereUserId($value)
 * @mixin \Eloquent
 */
final class ServiceListingLead extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_listing_id',
        'user_id',
        'lead_id',
        'contact_name',
        'contact_email',
        'contact_phone',
        'source',
        'status',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function listing()
    {
        return $this->belongsTo(ServiceListing::class, 'service_listing_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }
}

