<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property string|null $description
 * @property array<array-key, mixed>|null $filters
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\AdvertisingCampaign> $campaigns
 * @property int|null campaigns_count
 * @property-read \App\Models\Company $company
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereFilters($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingAudienceSegment withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class AdvertisingAudienceSegment extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'filters' => 'array',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function campaigns(): BelongsToMany
    {
        return $this->belongsToMany(AdvertisingCampaign::class, 'advertising_campaign_audience', 'segment_id', 'campaign_id')
            ->withPivot(['constraints'])
            ->withTimestamps();
    }

    /**
     * @psalm-return int<-4800, 5000>
     */
    public function estimateSize(): int
    {
        // Deterministic estimate based on filters to avoid randomness.
        $payload = json_encode($this->filters ?? []);
        $hash = crc32($payload);

        // Normalize into a reasonable candidate pool estimate (100 - 5000)
        $estimate = ($hash % 4901) + 100; // 100..5000

        return (int) $estimate;
    }
}
