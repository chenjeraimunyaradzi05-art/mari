<?php

namespace App\Models;

use App\Enums\OrganizationPageType;
use App\Models\Concerns\HasSocialProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int|null $company_id
 * @property OrganizationPageType $type
 * @property string $slug
 * @property string $name
 * @property string|null $tagline
 * @property string|null $about
 * @property string|null $mission
 * @property array<array-key, mixed>|null $declaration
 * @property array<array-key, mixed>|null $safety_commitments
 * @property array<array-key, mixed>|null $highlights
 * @property array<array-key, mixed>|null $policies
 * @property int|null $cover_media_id
 * @property string|null $hero_cta_label
 * @property string|null $hero_cta_url
 * @property string|null $website_url
 * @property string|null $contact_email
 * @property string|null $contact_phone
 * @property string $verification_status
 * @property int $safety_score
 * @property string $profile_status
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrgPageAdmin> $admins
 * @property int|null admins_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ApprenticeshipProgram> $apprenticeships
 * @property int|null apprenticeships_count
 * @property-read \App\Models\Company|null $company
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Course> $courses
 * @property int|null courses_count
 * @property-read \App\Models\OrgMediaAsset|null $coverMedia
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrgFollower> $followers
 * @property int|null followers_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\HousingListing> $housingListings
 * @property int|null housing_listings_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\IncidentReport> $incidentReports
 * @property int|null incident_reports_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrgInviteLog> $inviteLogs
 * @property int|null invite_logs_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\User> $invitedUsers
 * @property int|null invited_users_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Lead> $leads
 * @property int|null leads_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrgMediaAsset> $media
 * @property int|null media_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipProgram> $mentorshipPrograms
 * @property int|null mentorship_programs_count
 * @property-read array|null $persona_meta
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OrgPost> $posts
 * @property int|null posts_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Course> $publishedCourses
 * @property int|null published_courses_count
 * @property-read \App\Models\SocialProfile|null $socialProfile
 *
 * @method static \Database\Factories\OrganizationPageFactory factory($count = null, $state = [])
 * @method static Builder<static>|OrganizationPage newModelQuery()
 * @method static Builder<static>|OrganizationPage newQuery()
 * @method static Builder<static>|OrganizationPage onlyTrashed()
 * @method static Builder<static>|OrganizationPage published()
 * @method static Builder<static>|OrganizationPage query()
 * @method static Builder<static>|OrganizationPage whereAbout($value)
 * @method static Builder<static>|OrganizationPage whereCompanyId($value)
 * @method static Builder<static>|OrganizationPage whereContactEmail($value)
 * @method static Builder<static>|OrganizationPage whereContactPhone($value)
 * @method static Builder<static>|OrganizationPage whereCoverMediaId($value)
 * @method static Builder<static>|OrganizationPage whereCreatedAt($value)
 * @method static Builder<static>|OrganizationPage whereDeclaration($value)
 * @method static Builder<static>|OrganizationPage whereDeletedAt($value)
 * @method static Builder<static>|OrganizationPage whereHeroCtaLabel($value)
 * @method static Builder<static>|OrganizationPage whereHeroCtaUrl($value)
 * @method static Builder<static>|OrganizationPage whereHighlights($value)
 * @method static Builder<static>|OrganizationPage whereId($value)
 * @method static Builder<static>|OrganizationPage whereMission($value)
 * @method static Builder<static>|OrganizationPage whereName($value)
 * @method static Builder<static>|OrganizationPage wherePolicies($value)
 * @method static Builder<static>|OrganizationPage whereProfileStatus($value)
 * @method static Builder<static>|OrganizationPage wherePublishedAt($value)
 * @method static Builder<static>|OrganizationPage whereSafetyCommitments($value)
 * @method static Builder<static>|OrganizationPage whereSafetyScore($value)
 * @method static Builder<static>|OrganizationPage whereSlug($value)
 * @method static Builder<static>|OrganizationPage whereTagline($value)
 * @method static Builder<static>|OrganizationPage whereType($value)
 * @method static Builder<static>|OrganizationPage whereUpdatedAt($value)
 * @method static Builder<static>|OrganizationPage whereVerificationStatus($value)
 * @method static Builder<static>|OrganizationPage whereWebsiteUrl($value)
 * @method static Builder<static>|OrganizationPage withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|OrganizationPage withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class OrganizationPage extends Model
{
    use HasFactory;
    use HasSocialProfile;
    use SoftDeletes;

    protected $fillable = [
        'company_id',
        'type',
        'slug',
        'name',
        'tagline',
        'about',
        'mission',
        'highlights',
        'policies',
        'declaration',
        'safety_commitments',
        'cover_media_id',
        'hero_cta_label',
        'hero_cta_url',
        'website_url',
        'contact_email',
        'contact_phone',
        'verification_status',
        'safety_score',
        'profile_status',
        'published_at',
    ];

    protected $casts = [
        'type' => OrganizationPageType::class,
        'declaration' => 'array',
        'safety_commitments' => 'array',
        'highlights' => 'array',
        'policies' => 'array',
        'published_at' => 'datetime',
    ];

    protected $appends = [
        'persona_meta',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::saving(function (OrganizationPage $page) {
            if (blank($page->slug)) {
                $page->slug = Str::slug($page->name);
            }

            if ($page->isDirty('slug')) {
                $page->slug = static::uniqueSlug($page->slug, $page->id);
            }

            if ($page->isDirty('profile_status') && $page->profile_status === 'published' && blank($page->published_at)) {
                $page->published_at = now();
            }
        });
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('profile_status', 'published');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(OrgMediaAsset::class, 'org_page_id');
    }

    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(OrgMediaAsset::class, 'cover_media_id');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(OrgPost::class, 'org_page_id');
    }

    public function followers(): HasMany
    {
        return $this->hasMany(OrgFollower::class, 'org_page_id');
    }

    public function admins(): HasMany
    {
        return $this->hasMany(OrgPageAdmin::class, 'org_page_id');
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'org_page_id');
    }

    public function inviteLogs(): HasMany
    {
        return $this->hasMany(OrgInviteLog::class, 'org_page_id');
    }

    public function defaultLeadIntent(): string
    {
        return $this->type?->defaultLeadIntent() ?? 'general';
    }

    protected function personaMeta(): Attribute
    {
        return Attribute::get(fn (): ?array => $this->type?->personaMeta());
    }

    public function apprenticeships(): HasMany
    {
        return $this->hasMany(ApprenticeshipProgram::class, 'org_page_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'provider_org_page_id');
    }

    /**
     * @psalm-return HasMany<Model, Model>
     */
    public function publishedCourses(): HasMany
    {
        return $this->courses()->where('status', 'published');
    }

    public function housingListings(): HasMany
    {
        return $this->hasMany(HousingListing::class, 'org_page_id');
    }

    public function mentorshipPrograms(): HasMany
    {
        return $this->hasMany(MentorshipProgram::class, 'org_page_id');
    }

    public function incidentReports(): HasMany
    {
        return $this->hasMany(IncidentReport::class, 'org_page_id');
    }

    public function invitedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'org_page_admins', 'org_page_id', 'user_id');
    }

    private static function uniqueSlug(string $slug, ?int $ignoreId = null): string
    {
        $original = $slug;
        $counter = 1;

        while (self::where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $slug = $original.'-'.$counter++;
        }

        return $slug;
    }
}
