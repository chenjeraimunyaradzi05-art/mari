<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $project_id
 * @property int $profile_id
 * @property numeric|null $match_score
 * @property numeric|null $confidence
 * @property \App\Enums\WomenRealEstate\PartnerMatchStatus $status
 * @property array<array-key, mixed>|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\WomenRealEstate\WomenCohortProfile $profile
 * @property-read \App\Models\WomenRealEstate\WomenPartnerProject $project
 * @method static \Database\Factories\WomenRealEstate\WomenPartnerMatchFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch pending()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereConfidence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereMatchScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereProjectId($value)
 * final @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPartnerMatch whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WomenPartnerMatch extends Model
{
    use HasFactory;

    protected $table = 'women_partner_matches';

    protected $fillable = [
        'project_id',
        'profile_id',
        'match_score',
        'confidence',
        'status',
        'notes',
    ];

    protected $casts = [
        'match_score' => 'decimal:2',
        'confidence' => 'decimal:2',
        'status' => \App\Enums\WomenRealEstate\PartnerMatchStatus::class,
        'notes' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(WomenPartnerProject::class, 'project_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(WomenCohortProfile::class, 'profile_id');
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Builder<Model>
     */
    public function scopePending(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('status', \App\Enums\WomenRealEstate\PartnerMatchStatus::PENDING->value);
    }
}
