<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $brand
 * @property string $headline
 * @property string|null $description
 * @property string $cta_label
 * @property string $cta_url
 * @property string|null $discount_code
 * @property Carbon|null $valid_from
 * @property Carbon|null $valid_until
 * @property array<array-key, mixed>|null $interest_tags
 * @property int $priority
 * @property bool $requires_membership
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer relevantToInterest(?string $interest)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereBrand($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereCtaLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereCtaUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereDiscountCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereHeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereInterestTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer wherePriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereRequiresMembership($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereValidFrom($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingPartnerOffer whereValidUntil($value)
 * @mixin \Eloquent
 */
final class WellbeingPartnerOffer extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand',
        'headline',
        'description',
        'cta_label',
        'cta_url',
        'discount_code',
        'valid_from',
        'valid_until',
        'interest_tags',
        'priority',
        'requires_membership',
    ];

    protected $casts = [
        'valid_from' => 'date',
        'valid_until' => 'date',
        'interest_tags' => 'array',
        'requires_membership' => 'boolean',
    ];

    public function scopeActive($query)
    {
        $today = Carbon::today();

        return $query
            ->where(function ($sub) use ($today) {
                $sub->whereNull('valid_from')->orWhereDate('valid_from', '<=', $today);
            })
            ->where(function ($sub) use ($today) {
                $sub->whereNull('valid_until')->orWhereDate('valid_until', '>=', $today);
            });
    }

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

