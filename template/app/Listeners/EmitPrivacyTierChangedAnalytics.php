<?php

namespace App\Listeners;

use App\Events\ProfilePrivacyTierChanged;
use App\Services\RealTimeAnalyticsEngine;

final class EmitPrivacyTierChangedAnalytics
{
	private RealTimeAnalyticsEngine $analytics;

	public function __construct(RealTimeAnalyticsEngine $analytics)
	{
		$this->analytics = $analytics;
	}

	public function handle(ProfilePrivacyTierChanged $event): void
	{
		$profile = $event->profile;

		$this->analytics->record('persona.privacy.tier.changed', [
			'source' => 'privacy.service',
			'properties' => [
				'profile_id' => $profile->getKey(),
				'actor_user_id' => $event->actor?->getKey(),
				'from_tier' => $event->fromTier,
				'to_tier' => $event->toTier,
				'metadata' => $event->metadata ?? [],
			],
		]);
	}

}

