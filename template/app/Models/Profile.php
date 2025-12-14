<?php

namespace App\Models;

use App\Models\Concerns\HasSocialProfile;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $social_profile_id
 * @property string $persona_type
 * @property string $display_name
 * @property string $handle
 * @property string|null $bio
 * @property string|null $avatar_path
 * @property string|null $cover_path
 * @property string|null $pronouns
 * @property string|null $location
 * @property string|null $gender
 * @property string $age_bracket
 * @property bool $women_safety_mode
 * @property string $privacy_level
 * @property string $privacy_tier
 * @property string $dm_policy
 * @property string $tag_policy
 * @property string $mention_policy
 * @property string $location_visibility
 * @property array<array-key, mixed>|null $goals
 * @property array<array-key, mixed>|null $interests
 * @property array<array-key, mixed>|null $skills
 * @property array<array-key, mixed>|null $health_interests
 * @property array<array-key, mixed>|null $safety_overrides
 * @property bool $is_primary
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $last_switched_at
 * @property string|null $switch_context
 * @property \Illuminate\Support\Carbon|null $last_safety_mode_applied_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ProfileBadge> $badges
 * @property int|null badges_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ProfileBlock> $blocksInitiated
 * @property int|null blocks_initiated_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ProfileBlock> $blocksReceived
 * @property int|null blocks_received_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ConversationParticipant> $conversationParticipants
 * @property int|null conversation_participants_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Conversation> $conversations
 * @property int|null conversations_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Conversation> $initiatedConversations
 * @property int|null initiated_conversations_count
 * @property-read SocialProfile|null $personaSocialProfile
 * @property-read SocialProfile|null $socialProfile
 * @property-read \App\Models\User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ProfileVerification> $verificationRequests
 * @property int|null verification_requests_count
 *
 * @method static \Database\Factories\ProfileFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile forUser(\App\Models\User $user)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereAgeBracket($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereAvatarPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereBio($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereCoverPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereDisplayName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereDmPolicy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereGender($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereHandle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereHealthInterests($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereInterests($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereIsPrimary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereLastSafetyModeAppliedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereLastSwitchedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereLocationVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereMentionPolicy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile wherePersonaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile wherePrivacyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile wherePronouns($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereSafetyOverrides($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereSwitchContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereTagPolicy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile whereWomenSafetyMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile withoutTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Profile wherePrivacyTier($value)
 *
 * @mixin \Eloquent
 */
final class Profile extends Model
{
    use HasFactory;
    use HasSocialProfile;
    use SoftDeletes;

    public const PERSONA_TYPES = ['personal', 'professional', 'creator', 'business', 'anonymous', 'mentor'];

    public const AGE_BRACKETS = ['teen', 'adult', 'senior'];

    public const PRIVACY_LEVELS = ['public', 'followers', 'private'];

    public const POLICY_OPTIONS = ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one'];

    public const LOCATION_VISIBILITY = ['public', 'followers', 'trusted_contacts', 'hidden'];

    public const SWITCH_CONTEXTS = ['global_nav', 'composer', 'org_page', 'lead_form'];

    private const PERSONA_METADATA = [
        'personal' => [
            'label' => 'Personal',
            'tagline' => 'Lifestyle updates for trusted circles',
            'badge' => 'Personal Mode',
            'default_privacy' => 'followers',
        ],
        'professional' => [
            'label' => 'Professional',
            'tagline' => 'Work-ready persona for recruiters & orgs',
            'badge' => 'Professional Mode',
            'default_privacy' => 'public',
        ],
        'creator' => [
            'label' => 'Creator',
            'tagline' => 'Content-forward persona with boosts & analytics',
            'badge' => 'Creator Mode',
            'default_privacy' => 'public',
        ],
        'business' => [
            'label' => 'Business',
            'tagline' => 'Pitch partners, leads, and hiring funnels',
            'badge' => 'Business Mode',
            'default_privacy' => 'public',
        ],
        'anonymous' => [
            'label' => 'Anonymous',
            'tagline' => 'Share updates without exposing identity broadly.',
            'badge' => 'Anonymous Mode',
            'default_privacy' => 'followers',
        ],
        'mentor' => [
            'label' => 'Mentor',
            'tagline' => 'Guidance persona for mentees and cohorts.',
            'badge' => 'Mentor Mode',
            'default_privacy' => 'followers',
        ],
    ];

    protected $fillable = [
        'user_id',
        'social_profile_id',
        'persona_type',
        'display_name',
        'handle',
        'bio',
        'avatar_path',
        'cover_path',
        'pronouns',
        'location',
        'gender',
        'age_bracket',
        'women_safety_mode',
        'privacy_tier',
        'privacy_level',
        'dm_policy',
        'tag_policy',
        'mention_policy',
        'location_visibility',
        'goals',
        'interests',
        'skills',
        'health_interests',
        'safety_overrides',
        'is_primary',
        'is_active',
        'last_safety_mode_applied_at',
        'last_switched_at',
        'switch_context',
    ];

    protected $casts = [
        'women_safety_mode' => 'boolean',
        'privacy_tier' => 'string',
        'goals' => 'array',
        'interests' => 'array',
        'skills' => 'array',
        'health_interests' => 'array',
        'safety_overrides' => 'array',
        'is_primary' => 'boolean',
        'is_active' => 'boolean',
        'social_profile_id' => 'integer',
        'last_safety_mode_applied_at' => 'datetime',
        'last_switched_at' => 'datetime',
    ];

    public function personaSocialProfile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (Profile $profile) {
            $profile->handle = $profile->handle ?? Str::slug($profile->display_name);
            $profile->privacy_tier = $profile->privacy_tier ?? config('privacy.defaults.tier', 'network');
            $profile->applySafetyPresets();
        });

        self::saving(function (Profile $profile) {
            $profile->applySafetyPresets();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function badges(): HasMany
    {
        return $this->hasMany(ProfileBadge::class);
    }

    public function verificationRequests(): HasMany
    {
        return $this->hasMany(ProfileVerification::class);
    }

    public function initiatedConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'created_by_profile_id');
    }

    public function conversationParticipants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(Conversation::class, 'conversation_participants')
            ->withPivot(['role', 'status', 'last_read_at'])
            ->withTimestamps();
    }

    public function blocksInitiated(): HasMany
    {
        return $this->hasMany(ProfileBlock::class, 'blocker_profile_id');
    }

    public function blocksReceived(): HasMany
    {
        return $this->hasMany(ProfileBlock::class, 'blocked_profile_id');
    }

    public function scopeForUser($query, User $user)
    {
        return $query->where('user_id', $user->id);
    }

    public function isTeen(): bool
    {
        return $this->age_bracket === 'teen';
    }

    public function isAdult(): bool
    {
        return $this->age_bracket === 'adult';
    }

    public function isSenior(): bool
    {
        return $this->age_bracket === 'senior';
    }

    public function activate(): void
    {
        $this->user->forceFill(['active_profile_id' => $this->getKey()])->save();
    }

    public function applySafetyPresets(): void
    {
        if ($this->women_safety_mode) {
            $this->privacy_level = $this->ensureMaxPrivacy($this->privacy_level, 'followers');
            $this->dm_policy = $this->ensureMaxPrivacy($this->dm_policy, 'followers');
            $this->tag_policy = $this->ensureMaxPrivacy($this->tag_policy, 'followers');
            $this->mention_policy = $this->ensureMaxPrivacy($this->mention_policy, 'followers');
            $this->location_visibility = $this->ensureLocationPrivacy($this->location_visibility, 'trusted_contacts');
            $this->last_safety_mode_applied_at = now();
        }

        if ($this->isTeen()) {
            $this->privacy_level = $this->ensureMaxPrivacy($this->privacy_level, 'followers');
            $this->dm_policy = $this->ensureMaxPrivacy($this->dm_policy, 'followers');
            $this->location_visibility = $this->ensureLocationPrivacy($this->location_visibility, 'followers');
        }

        $this->ensurePrivacyTierAlignment();
    }

    public function privacyTier(): string
    {
        return $this->privacy_tier ?: $this->mapPrivacyLevelToTier($this->privacy_level);
    }

    private function ensureMaxPrivacy(?string $value, string $floor): string
    {
        $order = [
            'public' => 0,
            'everyone' => 0,
            'followers' => 1,
            'connections_only' => 2,
            'trusted' => 3,
            'mentors_only' => 4,
            'private' => 5,
            'no_one' => 6,
        ];
        $current = $order[$value] ?? 0;
        $min = $order[$floor] ?? 0;

        if ($current < $min) {
            return $floor;
        }

        return $value ?? $floor;
    }

    private function ensureLocationPrivacy(?string $value, string $floor): string
    {
        $order = ['public' => 0, 'followers' => 1, 'trusted_contacts' => 2, 'hidden' => 3];
        $current = $order[$value] ?? 0;
        $min = $order[$floor] ?? 0;

        if ($current < $min) {
            return $floor;
        }

        return $value ?? $floor;
    }

    private function ensurePrivacyTierAlignment(): void
    {
        $mapped = $this->mapPrivacyLevelToTier($this->privacy_level);
        $current = $this->privacy_tier;

        if ($current === null) {
            $this->privacy_tier = $mapped;

            return;
        }

        if ($this->tierRank($mapped) > $this->tierRank($current)) {
            $this->privacy_tier = $mapped;
        }
    }

    private function mapPrivacyLevelToTier(?string $privacyLevel): string
    {
        return match ($privacyLevel) {
            'followers' => 'network',
            'private' => 'invite_only',
            default => 'public',
        };
    }

    private function tierRank(?string $tier): int
    {
        return match ($tier) {
            'network' => 1,
            'invite_only' => 2,
            default => 0,
        };
    }

    public function hasBlocked(Profile $other): bool
    {
        return $this->blocksInitiated()->where('blocked_profile_id', $other->id)->exists();
    }

    public function isBlockedBy(Profile $other): bool
    {
        return $this->blocksReceived()->where('blocker_profile_id', $other->id)->exists();
    }

    /**
     * @return (bool|null|string)[]
     *
     * @psalm-return array{label: string, tagline: null|string, badge: null|string, default_privacy: 'followers'|'public', persona_type: string, is_active: bool, is_primary: bool, switch_context: null|string}
     */
    public function personaMeta(): array
    {
        $meta = self::PERSONA_METADATA[$this->persona_type] ?? [
            'label' => ucfirst($this->persona_type),
            'tagline' => null,
            'badge' => null,
            'default_privacy' => 'public',
        ];

        return array_merge($meta, [
            'persona_type' => $this->persona_type,
            'is_active' => (bool) $this->is_active,
            'is_primary' => (bool) $this->is_primary,
            'switch_context' => $this->switch_context,
        ]);
    }

    public function isMaxPrivacy(): bool
    {
        return $this->privacy_level === 'private'
            || $this->privacyTier() === 'invite_only'
            || $this->women_safety_mode
            || $this->isTeen();
    }

    /**
     * @return (bool|mixed|null|string)[]
     *
     * @psalm-return array{tier: string, label: mixed|string, description: mixed|null, social_profile_private: bool}
     */
    public function privacyTierSummary(): array
    {
        $tier = $this->privacyTier();
        $config = config("privacy.tiers.{$tier}", []);

        return [
            'tier' => $tier,
            'label' => $config['label'] ?? Str::title(str_replace('_', ' ', $tier)),
            'description' => $config['description'] ?? null,
            'social_profile_private' => (bool) ($config['social_profile_private'] ?? false),
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return list<'dm_policy'|'location_visibility'|'mention_policy'|'privacy_level'|'tag_policy'>
     */
    public function lockedPrivacyFields(): array
    {
        $locked = [];

        if ($this->women_safety_mode) {
            $locked = array_merge($locked, ['privacy_level', 'dm_policy', 'tag_policy', 'mention_policy', 'location_visibility']);
        }

        if ($this->isTeen()) {
            $locked = array_merge($locked, ['privacy_level', 'dm_policy', 'location_visibility']);
        }

        return array_values(array_unique($locked));
    }
}
