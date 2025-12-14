<?php

namespace App\Models;

use App\Enums\CompanyVerificationStatus;
use App\Models\Concerns\HasSocialProfile;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $name
 * @property string|null $slug
 * @property int|null $industry_type_id
 * @property int|null $organization_type_id
 * @property int|null $team_size_id
 * @property string|null $logo
 * @property string|null $banner
 * @property string|null $establishment_date
 * @property string|null $website
 * @property string|null $domain
 * @property string|null $phone
 * @property string|null $abn
 * @property string|null $asic_number
 * @property string|null $email
 * @property string|null $bio
 * @property string|null $vision
 * @property CompanyVerificationStatus $verification_status
 * @property \Illuminate\Support\Carbon|null $verification_submitted_at
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property int|null $verification_admin_id
 * @property string|null $verification_notes
 * @property array<array-key, mixed>|null $verification_payload
 * @property string $verification_source
 * @property string $foundation_status
 * @property string|null $foundation_summary
 * @property array<array-key, mixed>|null $foundation_focus_areas
 * @property array<array-key, mixed>|null $foundation_programs
 * @property array<array-key, mixed>|null $foundation_impact_metrics
 * @property string|null $foundation_contact_name
 * @property string|null $foundation_contact_email
 * @property string|null $foundation_contact_phone
 * @property string|null $foundation_donation_url
 * @property string|null $foundation_video_url
 * @property string|null $foundation_cta_label
 * @property string|null $foundation_cta_url
 * @property \Illuminate\Support\Carbon|null $foundation_launched_at
 * @property array<array-key, mixed>|null $foundation_social_links
 * @property int $total_views
 * @property string|null $address
 * @property int|null $city
 * @property int|null $state
 * @property int|null $country
 * @property string|null $map_link
 * @property int $is_profile_verified
 * @property string|null $document_verified_at
 * @property int $profile_completion
 * @property int $visibility
 * @property string|null $provider
 * @property string|null $provider_id
 * @property string|null $provider_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdvertisingAudienceSegment> $advertisingAudienceSegments
 * @property int|null advertising_audience_segments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdvertisingCampaign> $advertisingCampaigns
 * @property int|null advertising_campaigns_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdvertisingCreative> $advertisingCreatives
 * @property int|null advertising_creatives_count
 * @property-read \App\Models\City|null $companyCity
 * @property-read \App\Models\Country|null $companyCountry
 * @property-read \App\Models\State|null $companyState
 * @property-read \App\Models\IndustryType|null $industryType
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Job> $jobs
 * @property int|null jobs_count
 * @property-read \App\Models\CompanyVerification|null $latestVerification
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrganizationPage> $organizationPages
 * @property int|null organization_pages_count
 * @property-read \App\Models\OrganizationType|null $organizationType
 * @property-read \App\Models\User $owner
 * @property-read \App\Models\SocialProfile|null $socialProfile
 * @property-read \App\Models\TeamSize|null $teamSize
 * @property-read \App\Models\User $user
 * @property-read \App\Models\UserPlan|null $userPlan
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CompanyVerification> $verifications
 * @property int|null verifications_count
 *
 * @method static \Database\Factories\CompanyFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereAbn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereAsicNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereBanner($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereBio($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereDocumentVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereDomain($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereEstablishmentDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationContactEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationContactName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationContactPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationCtaLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationCtaUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationDonationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationFocusAreas($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationImpactMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationLaunchedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationPrograms($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationSocialLinks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereFoundationVideoUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereIndustryTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereIsProfileVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereLogo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereMapLink($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereOrganizationTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company wherePhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereProfileCompletion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereProviderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereProviderToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereState($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereTeamSizeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereTotalViews($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationAdminId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerificationSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereVision($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereWebsite($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @property string|null $stock_price
 * @property string|null final $market_cap
 * @property string|null $daily_change_percentage
 * @property string|null $last_market_update
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereDailyChangePercentage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereLastMarketUpdate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereMarketCap($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Company whereStockPrice($value)
 *
 * @mixin \Eloquent
 */
final class Company extends Model
{
    use HasFactory;
    use HasSocialProfile;
    use Sluggable;

    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'logo',
        'banner',
        'bio',
        'vision',
        'industry_type_id',
        'organization_type_id',
        'team_size_id',
        'establishment_date',
        'website',
        'email',
        'phone',
        'country',
        'state',
        'city',
        'address',
        'map_link',
        'abn',
        'asic_number',
        'domain',
        'verification_status',
        'verification_submitted_at',
        'verified_at',
        'verification_admin_id',
        'verification_notes',
        'verification_payload',
        'verification_source',
        'foundation_status',
        'foundation_summary',
        'foundation_focus_areas',
        'foundation_programs',
        'foundation_impact_metrics',
        'foundation_contact_name',
        'foundation_contact_email',
        'foundation_contact_phone',
        'foundation_donation_url',
        'foundation_video_url',
        'foundation_cta_label',
        'foundation_cta_url',
        'foundation_launched_at',
        'foundation_social_links',
    ];

    protected $casts = [
        'verification_status' => CompanyVerificationStatus::class,
        'verification_submitted_at' => 'datetime',
        'verified_at' => 'datetime',
        'verification_payload' => 'array',
        'foundation_focus_areas' => 'array',
        'foundation_programs' => 'array',
        'foundation_impact_metrics' => 'array',
        'foundation_social_links' => 'array',
        'foundation_launched_at' => 'datetime',
    ];

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'name'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'name',
            ],
        ];
    }

    public function industryType(): BelongsTo
    {
        return $this->belongsTo(IndustryType::class, 'industry_type_id', 'id');
    }

    public function organizationType(): BelongsTo
    {
        return $this->belongsTo(OrganizationType::class, 'organization_type_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function owner(): BelongsTo
    {
        return $this->user();
    }

    public function teamSize(): BelongsTo
    {
        return $this->belongsTo(TeamSize::class, 'team_size_id', 'id');
    }

    public function companyCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country', 'id');
    }

    public function companyState(): BelongsTo
    {
        return $this->belongsTo(State::class, 'state', 'id');
    }

    public function companyCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city', 'id');
    }

    public function userPlan(): HasOne
    {
        return $this->hasOne(UserPlan::class, 'company_id', 'id');
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(Job::class, 'company_id', 'id');
    }

    public function organizationPages(): HasMany
    {
        return $this->hasMany(OrganizationPage::class, 'company_id');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(CompanyVerification::class);
    }

    public function latestVerification(): HasOne
    {
        return $this->hasOne(CompanyVerification::class)->latestOfMany('submitted_at');
    }

    public function advertisingCampaigns(): HasMany
    {
        return $this->hasMany(AdvertisingCampaign::class);
    }

    public function advertisingAudienceSegments(): HasMany
    {
        return $this->hasMany(AdvertisingAudienceSegment::class);
    }

    public function advertisingCreatives(): HasMany
    {
        return $this->hasMany(AdvertisingCreative::class);
    }

    public function canPublishToSocialFeed(): bool
    {
        $userPlan = $this->userPlan;

        if (! $userPlan || ! $userPlan->plan) {
            return false;
        }

        return (bool) $userPlan->plan->allow_social_posts;
    }
}
