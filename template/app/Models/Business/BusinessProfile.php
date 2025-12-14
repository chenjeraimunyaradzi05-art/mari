<?php

namespace App\Models\Business;

use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $user_id
 * @property string $slug
 * @property string|null $venture_name
 * @property string|null $tagline
 * @property string $hero_theme
 * @property string|null $focus_industry
 * @property string $stage
 * @property string|null $team_size
 * @property string|null $revenue_range
 * @property string|null $market_focus
 * @property array<array-key, mixed>|null $focus_pillars
 * @property array<array-key, mixed>|null $support_needs
 * @property array<array-key, mixed>|null $metrics
 * @property array<array-key, mixed>|null $ai_snapshot
 * @property string|null $mission_statement
 * @property string|null $signature_offer
 * @property \Illuminate\Support\Carbon|null $last_ai_synced_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Business\BusinessMilestone> $milestones
 * @property int|null milestones_count
 * @property-read User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereAiSnapshot($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereFocusIndustry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereFocusPillars($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereHeroTheme($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereLastAiSyncedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereMarketFocus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereMissionStatement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereRevenueRange($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereSignatureOffer($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereStage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereSupportNeeds($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereTagline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereTeamSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereVentureName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile withoutTrashed()
 * @property array<array-key, mixed>|null $formation_questionnaire
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessProfile whereFormationQuestionnaire($value)
 * @mixin \Eloquent
 */
final class BusinessProfile extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'slug',
        'venture_name',
        'tagline',
        'hero_theme',
        'focus_industry',
        'stage',
        'team_size',
        'revenue_range',
        'market_focus',
        'focus_pillars',
        'support_needs',
        'metrics',
        'formation_questionnaire',
        'ai_snapshot',
        'mission_statement',
        'signature_offer',
        'last_ai_synced_at',
    ];

    protected $casts = [
        'focus_pillars' => 'array',
        'support_needs' => 'array',
        'metrics' => 'array',
        'formation_questionnaire' => 'array',
        'ai_snapshot' => 'array',
        'last_ai_synced_at' => 'datetime',
    ];

    public static array $palette = [
        'blush' => [
            'accent' => '#F472B6',
            'gradient' => 'linear-gradient(135deg, #f472b6 0%, #c084fc 100%)',
            'surface' => 'rgba(244, 114, 182, 0.12)',
        ],
        'twilight' => [
            'accent' => '#7C3AED',
            'gradient' => 'linear-gradient(135deg, #7c3aed 0%, #312e81 100%)',
            'surface' => 'rgba(124, 58, 237, 0.1)',
        ],
        'ember' => [
            'accent' => '#FB7185',
            'gradient' => 'linear-gradient(135deg, #fb7185 0%, #f97316 100%)',
            'surface' => 'rgba(251, 113, 133, 0.12)',
        ],
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::creating(function (self $profile): void {
            if (! $profile->slug) {
                $profile->slug = self::generateUniqueSlug(
                    $profile->venture_name ?? optional($profile->user)->name ?? 'business-hub'
                );
            }

            if (! $profile->hero_theme) {
                $profile->hero_theme = 'blush';
            }
        });

        static::created(function (self $profile): void {
            $profile->ensureSocialProfile();
            $profile->seedDefaultMilestones();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(BusinessMilestone::class)->orderBy('sort_order');
    }

    public static function generateUniqueSlug(string $base): string
    {
        $slug = Str::slug(Str::limit($base, 60, ''));

        if ($slug === '') {
            $slug = 'business-hub';
        }

        $candidate = $slug;
        $suffix = 1;

        while (self::where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    public function ensureSocialProfile(): ?SocialProfile
    {
        $user = $this->user;

        if (! $user) {
            return null;
        }

        $displayName = $this->venture_name ?: $user->name;
        $bio = $this->tagline ?: 'Building boldly inside the Business Network.';

        $socialProfile = $user->socialProfile;

        $profileType = $socialProfile->profile_type
            ?? ($user->account_classification === 'business_network'
                ? 'company'
                : ($user->role === 'company' ? 'company' : 'candidate'));

        if ($socialProfile) {
            $payload = [
                'display_name' => $displayName,
                'bio' => $socialProfile->bio ?: $bio,
            ];

            if ($user->account_classification === 'business_network') {
                $payload['profile_type'] = 'company';
            }

            $socialProfile->forceFill($payload);
            $socialProfile->saveQuietly();

            return $socialProfile->fresh();
        }

        $username = Str::slug(Str::limit($displayName, 40, ''));
        if ($username === '') {
            $username = 'business-'.$user->getKey();
        }

        return $user->socialProfile()->create([
            'user_id' => $user->getKey(),
            'profile_type' => $profileType,
            'display_name' => $displayName,
            'username' => $this->ensureUniqueUsername($username),
            'bio' => $bio,
        ]);
    }

    private function ensureUniqueUsername(string $base): string
    {
        $username = $base;
        $suffix = 1;

        while (SocialProfile::where('username', $username)->exists()) {
            $username = $base.'-'.$suffix;
            $suffix++;
        }

        return $username;
    }

    public function seedDefaultMilestones(): void
    {
        if ($this->milestones()->exists()) {
            return;
        }

        $templates = [
            [
                'title' => 'Design soft-launch funnel',
                'category' => 'go-to-market',
                'summary' => 'Create a graceful waitlist landing page, automate onboarding emails, and pick three beta partners.',
                'ai_prompt' => 'Outline a luxe beta invite flow for the Business Network.',
                'cta_label' => 'Open the funnel brief',
                'cta_url' => 'https://maven.com/programs/funnel-design',
                'due_date' => now()->addWeeks(2),
            ],
            [
                'title' => 'Secure three pilot customers',
                'category' => 'sales',
                'summary' => 'Pitch high-fit partners, co-design the success metrics, and lock the first testimonial.',
                'ai_prompt' => 'Craft a founder-to-founder pilot outreach note.',
                'cta_label' => 'Download the outreach script',
                'cta_url' => 'https://maven.com/programs/pilot-outreach',
                'due_date' => now()->addWeeks(4),
            ],
            [
                'title' => 'Ship community spotlight',
                'category' => 'brand',
                'summary' => 'Record a 60-second founder reel + carousel telling your origin story for the Business feed.',
                'ai_prompt' => 'Storyboard a short-form founder spotlight.',
                'cta_label' => 'View the content guide',
                'cta_url' => 'https://maven.com/programs/founder-storytelling',
                'due_date' => now()->addWeeks(6),
            ],
        ];

        foreach ($templates as $index => $template) {
            $this->milestones()->create([
                'title' => $template['title'],
                'category' => $template['category'],
                'summary' => $template['summary'],
                'ai_prompt' => $template['ai_prompt'],
                'cta_label' => $template['cta_label'],
                'cta_url' => $template['cta_url'],
                'due_date' => $template['due_date'],
                'sort_order' => $index + 1,
            ]);
        }
    }

    public function heroPalette(): array
    {
        return Arr::get(self::$palette, $this->hero_theme, self::$palette['blush']);
    }
}

