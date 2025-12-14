<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
	/**
	 * Transform the resource into an array.
	 *
	 * @param  \Illuminate\Http\Request  $request
	 * @return array
	 */
	public function toArray($request): array
	{
		return [
			'id' => $this->id,
			'handle' => $this->handle,
			'social_profile_id' => $this->social_profile_id ?? null,
			'display_name' => $this->display_name,
			'women_safety_mode' => (bool) ($this->women_safety_mode ?? false),
			'privacy_level' => $this->privacy_level ?? null,
			'privacy_tier' => $this->privacy_tier ?? 'public',
			'location_visibility' => $this->location_visibility ?? null,
			'privacy_controls' => [
				'tier' => $this->privacy_tier ?? 'public',
				'policies' => [
					'privacy_level' => $this->privacy_level ?? null,
					'dm_policy' => $this->dm_policy ?? null,
					'tag_policy' => $this->tag_policy ?? null,
					'mention_policy' => $this->mention_policy ?? null,
					'location_visibility' => $this->location_visibility ?? null,
				],
				'is_max_privacy' => ($this->resource?->isMaxPrivacy() ?? false),
				'locked_fields' => ($this->resource?->lockedPrivacyFields() ?? []),
			],
			'is_primary' => (bool) ($this->is_primary ?? false),
			'switch_context' => $this->switch_context ?? null,
		];
	}
}
