<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\SocialProfileVerification;
use Illuminate\Support\Collection;

final class SocialProfileVerificationPolicy
{


	public function update(Admin $admin, SocialProfileVerification $verification): bool
	{
		return $this->canReview($admin);
	}

	protected function canReview(Admin $admin): bool
	{
		$roles = $this->reviewerRoles();

		if ($roles->isEmpty()) {
			return true;
		}

		if (method_exists($admin, 'hasAnyRole') && $admin->hasAnyRole($roles->all())) {
			return true;
		}

		return false;
	}

	/**
	 * @psalm-return Collection<int, string>
	 */
	protected function reviewerRoles(): Collection
	{
		return collect(config('social.verification.reviewer_roles', []))
			->map(static fn ($role) => trim((string) $role))
			->filter()
			->values();
	}
}

