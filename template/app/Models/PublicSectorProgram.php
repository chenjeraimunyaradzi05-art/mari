<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $public_sector_agency_id
 * @property string $title
 * @property string $slug
 * @property string $program_type
 * @property string|null $delivery_mode
 * @property string $application_status
 * @property \Illuminate\Support\Carbon|null $next_intake_date
 * @property string|null $application_url
 * @property array<array-key, mixed>|null $support_channels
 * @property array<array-key, mixed>|null $tags
 * @property string|null $summary
 * @property string|null $eligibility
 * @property string|null $ai_recommendation
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\PublicSectorAgency $agency
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PublicSectorOpportunity> $opportunities
 * @property int|null opportunities_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereAiRecommendation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereApplicationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereApplicationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereDeliveryMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereEligibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereNextIntakeDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereProgramType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram wherePublicSectorAgencyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereSupportChannels($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorProgram whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class PublicSectorProgram extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_sector_agency_id',
        'title',
        'slug',
        'program_type',
        'delivery_mode',
        'application_status',
        'next_intake_date',
        'application_url',
        'support_channels',
        'tags',
        'summary',
        'eligibility',
        'ai_recommendation',
    ];

    protected $casts = [
        'support_channels' => 'array',
        'tags' => 'array',
        'next_intake_date' => 'date',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $program): void {
            if (empty($program->slug)) {
                $program->slug = Str::slug($program->title).'-'.Str::lower(Str::random(4));
            }
        });
    }

    /**
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(PublicSectorAgency::class, 'public_sector_agency_id');
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(PublicSectorOpportunity::class, 'public_sector_program_id');
    }
}
