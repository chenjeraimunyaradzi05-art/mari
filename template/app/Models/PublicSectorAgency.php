<?php

namespace App\Models;

use App\Models\Concerns\HasSocialProfile;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $tagline
 * @property string $category
 * @property string|null $hq_city
 * @property string|null $hq_country
 * @property string|null $hero_image
 * @property string|null $primary_contact
 * @property string|null $contact_email
 * @property array<array-key, mixed>|null $focus_areas
 * @property array<array-key, mixed>|null $service_regions
 * @property array<array-key, mixed>|null $social_handles
 * @property float $impact_score
 * @property string $status
 * @property string|null $summary
 * @property string|null $ai_summary
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string|null $hero_image_url
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PublicSectorOpportunity> $opportunities
 * @property int|null opportunities_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PublicSectorProgram> $programs
 * @property int|null programs_count
 * @property-read SocialProfile|null $socialProfile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency active()
 * @method static \Database\Factories\PublicSectorAgencyFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereAiSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereContactEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereFocusAreas($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereHeroImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereHqCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereHqCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereImpactScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency wherePrimaryContact($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereServiceRegions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereSocialHandles($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereTagline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereUpdatedAt($value)
 *
 * @property int|null $owner_id
 * @property-read \App\Models\User|null $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ProcurementOpportunity> $procurementOpportunities
 * @property int|null procurement_opportunities_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PublicSectorAgency whereOwnerId($value)
 *
 * @mixin \Eloquent
 */
final class PublicSectorAgency extends Model
{
    use HasFactory;
    use HasSocialProfile;

    protected $fillable = [
        'owner_id',
        'name',
        'slug',
        'tagline',
        'category',
        'hq_city',
        'hq_country',
        'hero_image',
        'primary_contact',
        'contact_email',
        'focus_areas',
        'service_regions',
        'social_handles',
        'impact_score',
        'status',
        'summary',
        'ai_summary',
    ];

    protected $casts = [
        'focus_areas' => 'array',
        'service_regions' => 'array',
        'social_handles' => 'array',
        'impact_score' => 'float',
    ];

    protected $appends = ['hero_image_url'];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $agency): void {
            if (empty($agency->slug)) {
                $agency->slug = Str::slug($agency->name).'-'.Str::lower(Str::random(4));
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

    public function owner(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function programs(): HasMany
    {
        return $this->hasMany(PublicSectorProgram::class);
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(PublicSectorOpportunity::class);
    }

    public function procurementOpportunities(): HasMany
    {
        return $this->hasMany(ProcurementOpportunity::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', '!=', 'archived');
    }

    public function getHeroImageUrlAttribute(): ?string
    {
        if (! $this->hero_image) {
            return null;
        }

        if (Str::startsWith($this->hero_image, ['http://', 'https://'])) {
            return $this->hero_image;
        }

        return asset('storage/'.$this->hero_image);
    }

    public function ensureSocialProfile(): SocialProfile
    {
        if ($this->relationLoaded('socialProfile') && $this->socialProfile) {
            return $this->socialProfile;
        }

        if ($profile = $this->socialProfile()->first()) {
            return $profile;
        }

        $username = Str::slug($this->slug);

        $existingProfile = SocialProfile::where('username', $username)->first();

        if ($existingProfile) {
            $existingProfile->fill([
                'display_name' => $this->name,
                'profile_type' => 'government',
                'bio' => $this->tagline ?: 'Championing civic innovation for women.',
            ]);

            $existingProfile->profileable()->associate($this);
            $existingProfile->save();

            return $existingProfile;
        }

        return $this->socialProfile()->create([
            'username' => $username,
            'display_name' => $this->name,
            'profile_type' => 'government',
            'bio' => $this->tagline ?: 'Championing civic innovation for women.',
        ]);
    }
}
