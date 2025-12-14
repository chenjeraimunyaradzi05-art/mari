<?php

namespace App\Models;

use App\Models\Concerns\HasSocialProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $owner_user_id
 * @property string $name
 * @property string $slug
 * @property string $institution_type
 * @property string|null $tagline
 * @property string|null $summary
 * @property string|null $mission_statement
 * @property string|null $brand_color
 * @property string|null $hero_image
 * @property string|null $website_url
 * @property string|null $contact_email
 * @property string|null $contact_phone
 * @property array<array-key, mixed>|null $location
 * @property array<array-key, mixed>|null $specialties
 * @property array<array-key, mixed>|null $support_channels
 * @property array<array-key, mixed>|null $ai_strengths
 * @property array<array-key, mixed>|null $impact_metrics
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TafeProgram> $activePrograms
 * @property int|null active_programs_count
 * @property-read string|null $hero_image_url
 * @property-read \App\Models\User $owner
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TafeProgram> $programs
 * @property int|null programs_count
 * @property-read \App\Models\SocialProfile|null $socialProfile
 * @method static Builder<static>|TafeInstitution live()
 * @method static Builder<static>|TafeInstitution newModelQuery()
 * @method static Builder<static>|TafeInstitution newQuery()
 * @method static Builder<static>|TafeInstitution onlyTrashed()
 * @method static Builder<static>|TafeInstitution query()
 * @method static Builder<static>|TafeInstitution whereAiStrengths($value)
 * @method static Builder<static>|TafeInstitution whereBrandColor($value)
 * @method static Builder<static>|TafeInstitution whereContactEmail($value)
 * @method static Builder<static>|TafeInstitution whereContactPhone($value)
 * @method static Builder<static>|TafeInstitution whereCreatedAt($value)
 * @method static Builder<static>|TafeInstitution whereDeletedAt($value)
 * @method static Builder<static>|TafeInstitution whereHeroImage($value)
 * @method static Builder<static>|TafeInstitution whereId($value)
 * @method static Builder<static>|TafeInstitution whereImpactMetrics($value)
 * @method static Builder<static>|TafeInstitution whereInstitutionType($value)
 * @method static Builder<static>|TafeInstitution whereLocation($value)
 * @method static Builder<static>|TafeInstitution whereMissionStatement($value)
 * @method static Builder<static>|TafeInstitution whereName($value)
 * @method static Builder<static>|TafeInstitution whereOwnerUserId($value)
 * @method static Builder<static>|TafeInstitution wherePublishedAt($value)
 * @method static Builder<static>|TafeInstitution whereSlug($value)
 * @method static Builder<static>|TafeInstitution whereSpecialties($value)
 * @method static Builder<static>|TafeInstitution whereStatus($value)
 * @method static Builder<static>|TafeInstitution whereSummary($value)
 * @method static Builder<static>|TafeInstitution whereSupportChannels($value)
 * @method static Builder<static>|TafeInstitution whereTagline($value)
 * @method static Builder<static>|TafeInstitution whereUpdatedAt($value)
 * @method static Builder<static>|TafeInstitution whereWebsiteUrl($value)
 * @method static Builder<static>|TafeInstitution withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|TafeInstitution withoutTrashed()
 * @method static \Database\Factories\TafeInstitutionFactory factory($count = null, $state = [])
 * @mixin \Eloquent
 */
final class TafeInstitution extends Model
{
    use HasFactory;
    use SoftDeletes;
    use HasSocialProfile;

    protected $fillable = [
        'owner_user_id',
        'name',
        'slug',
        'institution_type',
        'tagline',
        'summary',
        'mission_statement',
        'brand_color',
        'hero_image',
        'website_url',
        'contact_email',
        'contact_phone',
        'location',
        'specialties',
        'support_channels',
        'ai_strengths',
        'impact_metrics',
        'status',
        'published_at',
    ];

    protected $casts = [
        'location' => 'array',
        'specialties' => 'array',
        'support_channels' => 'array',
        'ai_strengths' => 'array',
        'impact_metrics' => 'array',
        'published_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::saving(function (TafeInstitution $institution): void {
            if (blank($institution->slug) && filled($institution->name)) {
                $institution->slug = Str::slug($institution->name);
            }

            if ($institution->isDirty('slug')) {
                $institution->slug = static::uniqueSlug($institution->slug, $institution->id);
            }

            if ($institution->isDirty('status') && $institution->status === 'live' && blank($institution->published_at)) {
                $institution->published_at = now();
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function programs(): HasMany
    {
        return $this->hasMany(TafeProgram::class);
    }

    /**
     * @psalm-return HasMany<Model, Model>
     */
    public function activePrograms(): HasMany
    {
        return $this->programs()->where('status', 'published');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeLive(Builder $builder): Builder
    {
        return $builder->where('status', 'live');
    }

    public function getHeroImageUrlAttribute(): ?string
    {
        if (!$this->hero_image) {
            return null;
        }

        if (Str::startsWith($this->hero_image, ['http://', 'https://'])) {
            return $this->hero_image;
        }

        return asset('storage/'.$this->hero_image);
    }

    /**
     * @return string
     *
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    private static function uniqueSlug(string $slug, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'institution';
        $candidate = $base;
        $counter = 1;

        while (static::where('slug', $candidate)
            ->when($ignoreId, fn (Builder $query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $candidate = $base.'-'.$counter++;
        }

        return $candidate;
    }
}

