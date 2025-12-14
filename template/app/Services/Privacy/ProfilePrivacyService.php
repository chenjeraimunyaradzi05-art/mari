<?php

namespace App\Services\Privacy;

use App\Events\ProfilePrivacyTierChanged;
use App\Models\Profile;
use App\Models\User;
use App\Services\Social\SocialProfileProvisioner;
use App\Services\Privacy\PrivacyTierService;
use App\Services\Privacy\ProfilePrivacyAuditLogger;

final class ProfilePrivacyService
{
    private SocialProfileProvisioner $socialProfiles;
    private PrivacyTierService $privacyTiers;
    private ProfilePrivacyAuditLogger $audits;

    public function __construct(
        ?SocialProfileProvisioner $socialProfiles = null,
        ?PrivacyTierService $privacyTiers = null,
        ?ProfilePrivacyAuditLogger $audits = null
    ) {
        $this->socialProfiles = $socialProfiles ?? new SocialProfileProvisioner();
        $this->privacyTiers = $privacyTiers ?? new PrivacyTierService();
        $this->audits = $audits ?? new ProfilePrivacyAuditLogger();
    }


    public function update(Profile $profile, array $attributes, ?User $actor = null): Profile|null
    {
        $reason = $this->extractReason($attributes);
        $metadata = $attributes['audit_metadata'] ?? [];
        unset($attributes['audit_metadata']);

        if (array_key_exists('privacy_tier', $attributes)) {
            $requestedTier = (string) $attributes['privacy_tier'];
            unset($attributes['privacy_tier']);
            $this->applyTier($profile, $requestedTier, $actor, $reason, $metadata);
        }

        $profile->fill($attributes);
        $profile->save();

        $this->socialProfiles->provisionForProfile($profile);

        return $profile->fresh('badges');
    }

    public function applyTier(
        Profile $profile,
        string $requestedTier,
        ?User $actor = null,
        string $reason = 'member_action',
        array $metadata = []
    ): void {
        $fromTier = $profile->privacyTier();
        $targetTier = $this->determineTier($profile, $requestedTier);
        $wasForced = $targetTier !== $requestedTier;

        if ($this->tierMatches($fromTier, $targetTier)) {
            return;
        }

        $this->privacyTiers->applyTier($profile, $targetTier);
        $profile->save();

        $auditMetadata = array_merge($metadata, [
            'requested_tier' => $requestedTier,
            'forced_by_rules' => $wasForced,
        ]);

        $this->audits->log($profile, $actor, $fromTier, $profile->privacyTier(), $reason, $auditMetadata);

        event(new ProfilePrivacyTierChanged($profile, $actor, $fromTier, $profile->privacyTier(), [
            'reason' => $reason,
            'requested_tier' => $requestedTier,
            'forced_by_rules' => $wasForced,
        ]));

        $this->socialProfiles->provisionForProfile($profile);
    }

    private function determineTier(Profile $profile, string $requestedTier): string
    {
        if ($this->privacyTiers->shouldForcePrivate($profile)) {
            return 'invite_only';
        }

        if ($this->privacyTiers->tierExists($requestedTier)) {
            return $requestedTier;
        }

        return $this->privacyTiers->defaultTier();
    }

    private function tierMatches(string $current, string $target): bool
    {
        return $current === $target;
    }

    private function extractReason(array &$attributes): string
    {
        $reason = isset($attributes['reason']) ? trim((string) $attributes['reason']) : '';
        unset($attributes['reason']);

        return $reason !== '' ? $reason : 'member_action';
    }
}

