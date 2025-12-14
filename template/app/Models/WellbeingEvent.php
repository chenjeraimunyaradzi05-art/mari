<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $title
 * @property string $type
 * @property string $mode
 * @property string|null $location_region
 * @property string|null $location_venue
 * @property \Illuminate\Support\Carbon|null $starts_at
 * @property \Illuminate\Support\Carbon|null $ends_at
 * @property string|null $organiser_name
 * @property string|null $sponsor_name
 * @property bool $women_only
 * @property bool $is_body_positive
 * @property bool $is_adaptive
 * @property bool $is_dv_safe
 * @property bool $is_prenatal_postnatal
 * @property string|null $intensity
 * @property string|null $summary
 * @property string|null $accessibility_notes
 * @property string|null $registration_url
 * @property array<array-key, mixed>|null $interest_tags
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent relevantToInterest(?string $interest)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereAccessibilityNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereEndsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereIntensity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereInterestTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereIsAdaptive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereIsBodyPositive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereIsDvSafe($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereIsPrenatalPostnatal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereLocationRegion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereLocationVenue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereOrganiserName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereRegistrationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereSponsorName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereStartsAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingEvent whereWomenOnly($value)
 * @mixin \Eloquent
 */
final class WellbeingEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'type',
        'mode',
        'location_region',
        'location_venue',
        'starts_at',
        'ends_at',
        'organiser_name',
        'sponsor_name',
        'women_only',
        'is_body_positive',
        'is_adaptive',
        'is_dv_safe',
        'is_prenatal_postnatal',
        'accessibility_notes',
        'intensity',
        'summary',
        'registration_url',
        'interest_tags',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'women_only' => 'boolean',
        'is_body_positive' => 'boolean',
        'is_adaptive' => 'boolean',
        'is_dv_safe' => 'boolean',
        'is_prenatal_postnatal' => 'boolean',
        'interest_tags' => 'array',
    ];

    public function scopeRelevantToInterest($query, ?string $interest)
    {
        if (! $interest) {
            return $query;
        }

        return $query->where(function ($sub) use ($interest) {
            $sub->whereNull('interest_tags')
                ->orWhereJsonContains('interest_tags', $interest)
                ->orWhereJsonContains('interest_tags', 'wellness');
        });
    }
}

