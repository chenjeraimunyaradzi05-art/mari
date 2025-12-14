<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $agent_id
 * @property int|null $user_id
 * @property int|null $listing_id
 * @property string $type
 * @property string $status
 * @property string|null $source
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenVerifiedAgent $agent
 * @property-read \App\Models\WomenRealEstate\WomenListing|null $listing
 * @property-read User|null $user
 * @method static \Database\Factories\WomenRealEstate\WomenAgentLeadFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereAgentId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereListingId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenAgentLead whereUserId($value)
 * @mixin \Eloquent
 */
final class WomenAgentLead extends Model
{
    use HasFactory;

    protected $table = 'women_agent_leads';

    protected $fillable = [
        'agent_id',
        'user_id',
        'listing_id',
        'type',
        'status',
        'source',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(WomenVerifiedAgent::class, 'agent_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(WomenListing::class, 'listing_id');
    }
}

