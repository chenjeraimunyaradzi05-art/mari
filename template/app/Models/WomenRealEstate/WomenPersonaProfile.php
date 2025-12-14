<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Casts\EncryptedJson;
use App\Events\WomenRealEstate\PersonaProfileUpdated;
use App\Models\User;
use App\Models\WomenRealEstate\WomenAgentProfile;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenPersonaProfileAudit;
use App\Models\WomenRealEstate\WomenPropertySeeker;
use App\Models\WomenRealEstate\WomenUserMedia;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Arr;

/**
 * @property int $id
 * @property int $user_id
 * @property string $persona
 * @property mixed|null $identity
 * @property mixed|null $household
 * @property array<array-key, mixed>|null $lifestyle
 * @property array<array-key, mixed>|null $work
 * @property array<array-key, mixed>|null $transport
 * @property array<array-key, mixed>|null $media
 * @property array<array-key, mixed>|null $ai_meta
 * @property array<array-key, mixed>|null $social_meta
 * @property array<array-key, mixed>|null $visibility_preferences
 * @property int|null $featured_media_id
 * @property int $completion_score
 * @property bool $highlight_in_feed
 * @property bool $auto_share_opt_in
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read WomenAgentProfile|null $agentProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenPersonaProfileAudit> $audits
 * @property int|null audits_count
 * @property-read WomenUserMedia|null $featuredMedia
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenListing> $listings
 * @property int|null listings_count
 * @property-read WomenPropertySeeker|null $seekerProfile
 * @property-read User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile forPersona(string $persona)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereAiMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereAutoShareOptIn($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereCompletionScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereFeaturedMediaId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereHighlightInFeed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereHousehold($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereIdentity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereLifestyle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereMedia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<final static>|WomenPersonaProfile wherePersona($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereSocialMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereTransport($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereVisibilityPreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfile whereWork($value)
 * @mixin \Eloquent
 */
final class WomenPersonaProfile extends Model
{
    use HasFactory;

    public const PERSONA_HOUSEHUNTER = 'househunter';
    public const PERSONA_LANDLORD = 'landlord';
    public const PERSONA_AGENT = 'agent';
    public const PERSONA_INVESTOR = 'investor';
    public const PERSONA_ALLY = 'ally';
    public const PERSONA_STUDENT = 'student';
    public const PERSONA_ENTREPRENEUR = 'entrepreneur';

    public const PERSONAS = [
        self::PERSONA_HOUSEHUNTER,
        self::PERSONA_AGENT,
        self::PERSONA_STUDENT,
        self::PERSONA_ENTREPRENEUR,
        self::PERSONA_LANDLORD,
        self::PERSONA_INVESTOR,
        self::PERSONA_ALLY,
    ];

    public const PERSONA_LABELS = [
        self::PERSONA_HOUSEHUNTER => 'Renter / Seeker',
        self::PERSONA_LANDLORD => 'Landlord / Host',
        self::PERSONA_AGENT => 'Licensed Agent / Advocate',
        self::PERSONA_INVESTOR => 'Buyer / Investor',
        self::PERSONA_ALLY => 'Community Ally',
        self::PERSONA_STUDENT => 'Student / Graduate',
        self::PERSONA_ENTREPRENEUR => 'Entrepreneur / Founder',
    ];

    protected $fillable = [
        'user_id',
        'persona',
        'identity',
        'household',
        'lifestyle',
        'work',
        'transport',
        'media',
        'ai_meta',
        'social_meta',
        'visibility_preferences',
        'featured_media_id',
        'completion_score',
        'highlight_in_feed',
        'auto_share_opt_in',
        'completed_at',
    ];

    protected $casts = [
        'identity' => EncryptedJson::class,
        'household' => EncryptedJson::class,
        'lifestyle' => 'array',
        'work' => 'array',
        'transport' => 'array',
        'media' => 'array',
        'ai_meta' => 'array',
        'social_meta' => 'array',
        'visibility_preferences' => 'array',
        'highlight_in_feed' => 'bool',
        'auto_share_opt_in' => 'bool',
        'completion_score' => 'int',
        'completed_at' => 'datetime',
    ];

    /**
     * @return string[]
     *
     * @psalm-return array<string, string>
     */
    public static function personaOptions(): array
    {
        return collect(self::PERSONAS)
            ->mapWithKeys(fn (string $persona) => [
                $persona => self::PERSONA_LABELS[$persona] ?? ucfirst(str_replace('_', ' ', $persona)),
            ])
            ->all();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function featuredMedia(): BelongsTo
    {
        return $this->belongsTo(WomenUserMedia::class, 'featured_media_id');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(WomenPersonaProfileAudit::class, 'persona_profile_id');
    }

    public function seekerProfile(): HasOne
    {
        return $this->hasOne(WomenPropertySeeker::class, 'user_id', 'user_id');
    }

    public function agentProfile(): HasOne
    {
        return $this->hasOne(WomenAgentProfile::class, 'user_id', 'user_id');
    }

    public function listings(): HasMany
    {
        return $this->hasMany(WomenListing::class, 'owner_id', 'user_id');
    }

    public function scopeForPersona($query, string $persona)
    {
        return $query->where('persona', $persona);
    }

    public function refreshCompletionScore(): static
    {
        $sections = ['identity', 'household', 'lifestyle', 'work', 'transport', 'media'];
        $totals = ['filled' => 0, 'possible' => 0];

        foreach ($sections as $section) {
            $payload = Arr::wrap($this->{$section});

            foreach ($payload as $value) {
                if (is_array($value) && array_key_exists('value', $value)) {
                    $totals['possible']++;
                    if ($value['value'] !== null && $value['value'] !== '') {
                        $totals['filled']++;
                    }
                    continue;
                }

                if (is_array($value)) {
                    foreach ($value as $nested) {
                        $totals['possible']++;
                        if (is_array($nested)) {
                            $filled = $nested['value'] ?? $nested;
                            if ($filled !== null && $filled !== '') {
                                $totals['filled']++;
                            }
                            continue;
                        }

                        if ($nested !== null && $nested !== '') {
                            $totals['filled']++;
                        }
                    }
                    continue;
                }

                $totals['possible']++;
                if ($value !== null && $value !== '') {
                    $totals['filled']++;
                }
            }
        }

        $score = $totals['possible'] > 0
            ? (int) round(($totals['filled'] / $totals['possible']) * 100)
            : 0;

        $this->completion_score = $score;
        $this->completed_at = $score >= 80 ? ($this->completed_at ?? now()) : null;

        return $this;
    }

    public function recordAudit(array $changes, array $visibilitySnapshot, ?int $actorId = null, ?string $reason = null): void
    {
        $this->audits()->create([
            'performed_by' => $actorId,
            'changes' => $changes,
            'visibility_snapshot' => $visibilitySnapshot,
            'reason' => $reason,
        ]);
    }

    public function markUpdated(): void
    {
        PersonaProfileUpdated::dispatch($this);
    }
}
