<?php

namespace App\Services\Messaging;

use App\DataTransferObjects\Messaging\MessagingPreviewDecision;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\Privacy\PrivacyAccessLogger;
use App\Services\RealTimeAnalyticsEngine;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;

final class MessagingPreviewPrivacyGuard
{
    /** @var array<string, bool> */
    private array $followCache = [];

    public function __construct(private PrivacyAccessLogger $privacyLogger, private RealTimeAnalyticsEngine $analytics)
    {
    }

    public function evaluate(
        ?User $viewer,
        ?SocialProfile $sender,
        ?int $threadId = null,
        ?int $messageId = null,
        bool $isSystem = false
    ): MessagingPreviewDecision {
        if ($isSystem || ! $sender) {
            return MessagingPreviewDecision::allow();
        }

        if ($viewer && $sender->isOwnedByUser($viewer)) {
            return MessagingPreviewDecision::allow();
        }

        $viewerSocial = $viewer ? ActiveSocialProfile::forUser($viewer, false) : null;

        if ($viewerSocial && (int) $viewerSocial->getKey() === (int) $sender->getKey()) {
            return MessagingPreviewDecision::allow();
        }

        if (! $this->requiresFollowerGate($sender)) {
            return MessagingPreviewDecision::allow();
        }

        if ($viewerSocial && $this->viewerFollowsSender($viewerSocial, $sender)) {
            return MessagingPreviewDecision::allow();
        }

        $decision = MessagingPreviewDecision::redact('follower_required', [
            'sender_profile_id' => $sender->getKey(),
            'thread_id' => $threadId,
            'message_id' => $messageId,
        ]);

        if ($viewer) {
            $this->recordAnalytics($viewer, $viewerSocial, $sender, $decision, $threadId, $messageId);
        }

        return $decision;
    }

    private function requiresFollowerGate(SocialProfile $sender): bool
    {
        if ($sender->is_private) {
            return true;
        }

        $preferences = $sender->privacy_preferences ?? [];
        $privacyLevel = strtolower((string) ($preferences['privacy_level'] ?? ''));
        $privacyTier = strtolower((string) ($preferences['privacy_tier'] ?? ''));

        if (in_array($privacyLevel, ['private', 'followers'], true)) {
            return true;
        }

        return $privacyTier === 'invite_only';
    }

    private function viewerFollowsSender(SocialProfile $viewer, SocialProfile $sender): bool
    {
        $cacheKey = sprintf('%d:%d', $viewer->getKey(), $sender->getKey());

        if (! array_key_exists($cacheKey, $this->followCache)) {
            $this->followCache[$cacheKey] = $viewer->isFollowing($sender);
        }

        return $this->followCache[$cacheKey];
    }

    private function recordAnalytics(
        User $viewer,
        ?SocialProfile $viewerSocial,
        SocialProfile $sender,
        MessagingPreviewDecision $decision,
        ?int $threadId,
        ?int $messageId
    ): void {
        $viewerProfile = ActiveProfile::forUser($viewer);
        $senderTier = strtolower((string) data_get($sender->privacy_preferences, 'privacy_tier', 'network'));
        $privacyLevel = strtolower((string) data_get($sender->privacy_preferences, 'privacy_level', $sender->is_private ? 'private' : 'public'));

        $metadata = array_merge($decision->metadata, [
            'sender_privacy_level' => $privacyLevel,
            'sender_privacy_tier' => $senderTier,
        ]);

        $this->privacyLogger->log(
            $viewer,
            $viewerProfile,
            $viewerSocial,
            'messaging_preview',
            $senderTier,
            ['message_body'],
            [],
            ['message_body'],
            'blocked',
            $metadata
        );

        $this->analytics->record('privacy.messaging.preview_blocked', [
            'source' => 'messaging',
            'properties' => [
                'viewer_user_id' => $viewer->getKey(),
                'viewer_profile_id' => $viewerProfile?->getKey(),
                'viewer_social_profile_id' => $viewerSocial?->getKey(),
                'sender_profile_id' => $sender->getKey(),
                'thread_id' => $threadId,
                'message_id' => $messageId,
                'reason' => $decision->reason,
            ],
            'metadata' => $metadata,
        ]);
    }
}

