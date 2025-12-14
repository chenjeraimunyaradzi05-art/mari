<?php

declare(strict_types=1);

namespace App\Observers\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Support\Carbon;

final class WomenVerifiedAgentObserver
{
	public function updated(WomenVerifiedAgent $agent): void
	{
		// If the agent's verification status was downgraded or verified_at cleared,
		// downgrade any published listings associated with the agent.
		if ($agent->wasChanged('status') || $agent->wasChanged('verified_at')) {
			$needsDemote = $agent->verified_at === null || $agent->status !== 'active';

			if ($needsDemote) {
				WomenListing::query()
					->where('agent_id', $agent->id)
					->where('is_verified', true)
					->update([
						'is_verified' => false,
						'published_at' => null,
					]);
			}
		}
	}

}

