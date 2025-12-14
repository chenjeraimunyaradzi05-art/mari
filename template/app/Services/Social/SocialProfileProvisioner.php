<?php

namespace App\Services\Social;

use App\Models\Profile;
use App\Models\SocialProfile;
use App\Services\Privacy\PrivacyTierService;
use Illuminate\Support\Str;

final class SocialProfileProvisioner
{
    private PrivacyTierService $privacyTiers;

    public function __construct(?PrivacyTierService $privacyTiers = null)
    {
        $this->privacyTiers = $privacyTiers ?? new PrivacyTierService();
    }
    private const PERSONA_TO_SOCIAL_TYPE = [
        'personal' => 'candidate',
        'professional' => 'company',
        'creator' => 'sole_trader',
        'business' => 'company',
        'anonymous' => 'candidate',
        'mentor' => 'education_provider',
    ];

    public function provisionForProfile(Profile $profile): SocialProfile|null
    {
        if ($existing = $this->resolveExisting($profile)) {
            return $this->syncPersonaState($existing, $profile);
        }

        $username = $this->generateUniqueUsername($profile->handle ?? $profile->display_name ?? 'persona-'.$profile->id);

        $socialProfile = SocialProfile::create([
            'profileable_type' => Profile::class,
            'profileable_id' => $profile->id,
            'user_id' => $profile->user_id,
            'username' => $username,
            'display_name' => $profile->display_name,
            'bio' => $profile->bio ? Str::limit($profile->bio, 500) : null,
            'profile_type' => $this->determineProfileType($profile),
            'persona_key' => $this->personaKey($profile),
            'persona_meta' => $profile->personaMeta(),
            'privacy_preferences' => $this->privacyPreferences($profile),
            'is_private' => $this->shouldBePrivate($profile),
            'followers_count' => 0,
            'following_count' => 0,
            'posts_count' => 0,
        ]);

        $profile->forceFill(['social_profile_id' => $socialProfile->id])->saveQuietly();

        return $this->syncPersonaState($socialProfile, $profile);
    }

    private function resolveExisting(Profile $profile): ?SocialProfile
    {
        if ($profile->relationLoaded('personaSocialProfile') && $profile->personaSocialProfile) {
            return $profile->personaSocialProfile;
        }

        if ($profile->social_profile_id) {
            return SocialProfile::query()->find($profile->social_profile_id);
        }

        if ($profile->relationLoaded('socialProfile') && $profile->socialProfile) {
            return $profile->socialProfile;
        }

        return null;
    }

    private function generateUniqueUsername(string $preferred): string
    {
        $base = $this->sanitizeUsername($preferred) ?: 'persona';
        $candidate = $base;
        $suffix = 1;

        while (SocialProfile::where('username', $candidate)->exists()) {
            $candidate = $base.'_'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function sanitizeUsername(string $value): string
    {
        $sanitized = Str::slug($value, '_');

        return (string) Str::of($sanitized)->substr(0, 40);
    }

    private function determineProfileType(Profile $profile): string
    {
        return self::PERSONA_TO_SOCIAL_TYPE[$profile->persona_type] ?? 'candidate';
    }

    private function shouldBePrivate(Profile $profile): bool
    {
        if ($this->privacyTiers->shouldForcePrivate($profile)) {
            return true;
        }

        $tier = $profile->privacyTier();
        $config = $this->privacyTiers->tiers()[$tier] ?? [];

        if (array_key_exists('social_profile_private', $config)) {
            return (bool) $config['social_profile_private'];
        }

        return in_array($profile->privacy_level, ['private', 'followers'], true);
    }

    private function syncPersonaState(SocialProfile $socialProfile, Profile $profile): SocialProfile|null
    {
        $updates = [
            'persona_key' => $this->personaKey($profile),
            'persona_meta' => $profile->personaMeta(),
            'privacy_preferences' => $this->privacyPreferences($profile),
        ];

        $updates['is_private'] = $this->shouldBePrivate($profile);

        $socialProfile->forceFill($updates)->saveQuietly();

        return $socialProfile->fresh();
    }

    private function personaKey(Profile $profile): string
    {
        return $profile->persona_type ?: 'professional';
    }

    /**
     * @return string[]
     *
     * @psalm-return array{privacy_tier: string, privacy_level: string, dm_policy: string, tag_policy: string, mention_policy: string, location_visibility: string}
     */
    private function privacyPreferences(Profile $profile): array
    {
        return [
            'privacy_tier' => $profile->privacyTier(),
            'privacy_level' => $profile->privacy_level,
            'dm_policy' => $profile->dm_policy,
            'tag_policy' => $profile->tag_policy,
            'mention_policy' => $profile->mention_policy,
            'location_visibility' => $profile->location_visibility,
        ];
    }
}

