<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $utm_source
 * @property string|null $utm_medium
 * @property string|null $utm_campaign
 * @property string|null $utm_term
 * @property string|null $utm_content
 * @property string|null $referrer_url
 * @property string|null $landing_page
 * @property string|null $device_type
 * @property string|null $browser
 * @property string|null $country_code
 * @property \Illuminate\Support\Carbon $first_visit_at
 * @property \Illuminate\Support\Carbon|null $conversion_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereBrowser($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereConversionAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereCountryCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereDeviceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereFirstVisitAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereLandingPage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereReferrerUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUtmCampaign($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUtmContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUtmMedium($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUtmSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MarketingAttribution whereUtmTerm($value)
 *
 * @mixin \Eloquent
 */
final class MarketingAttribution extends Model
{
    use HasFactory;

    protected $table = 'marketing_attribution';

    protected $fillable = [
        'user_id',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'referrer_url',
        'landing_page',
        'device_type',
        'browser',
        'country_code',
        'first_visit_at',
        'conversion_at',
    ];

    protected $casts = [
        'first_visit_at' => 'datetime',
        'conversion_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
