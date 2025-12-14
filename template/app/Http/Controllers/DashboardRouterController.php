<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserPrimaryPurpose;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class DashboardRouterController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return redirect()->route('login');
        }

        if ($override = $this->resolveOverride($request)) {
            return redirect()->to($override);
        }

        if ($roleDashboard = $this->resolveRoleDashboardDestination($user)) {
            return redirect()->to($roleDashboard);
        }

        return redirect()->to($this->determineDestination($user));
    }

    protected function resolveOverride(Request $request): ?string
    {
        $target = strtolower(trim((string) $request->query('target', '')));

        return match ($target) {
            'member', 'athena' => route('member.dashboard'),
            'candidate' => route('member.dashboard'),
            'company' => route('company.dashboard'),
            'business' => route('business.dashboard'),
            'real-estate', 'realestate', 'property' => route('real-estate.shortcut'),
            'public', 'public-sector' => route('public-sector.dashboard'),
            'tafe', 'university', 'education' => route('education.tafe.dashboard'),
            default => null,
        };
    }

    protected function resolveRoleDashboardDestination(User $user): ?string
    {
        $profile = $user->primaryPurposeProfile;

        if (! $profile) {
            return null;
        }

        $roleKey = $profile->primary_purpose;
        $roleConfig = config("dashboard_roles.roles.{$roleKey}");

        if (! $roleConfig) {
            return null;
        }

        $requiredFlag = $roleConfig['feature_flag'] ?? null;

        if ($requiredFlag && ! $this->purposeHasFeatureFlag($profile, $requiredFlag)) {
            return null;
        }

        return route('dashboards.role.show');
    }

    protected function determineDestination(User $user): string
    {
        if ($user->account_classification === 'real_estate') {
            return route('real-estate.shortcut');
        }

        if ($user->account_classification === 'tafe_university') {
            return route('education.tafe.dashboard');
        }

        if ($user->account_classification === 'public_sector') {
            return route('public-sector.dashboard');
        }

        if ($user->account_classification === 'business_network') {
            return route('business.dashboard');
        }

        if ($user->role === 'company') {
            return route('company.dashboard');
        }

        if ($user->role === 'candidate' || $user->role === 'member') {
            return route('member.dashboard');
        }

        if ($user->hasRole('mentor')) {
            return route('mentor.moderation.dashboard');
        }

        return route('member.dashboard');
    }

    private function purposeHasFeatureFlag(UserPrimaryPurpose $profile, string $flag): bool
    {
        $roleKey = $profile->primary_purpose;

        $flags = array_unique(array_merge(
            config("signup.primary_purposes.{$roleKey}.feature_flags", []),
            $profile->feature_flags ?? []
        ));

        return in_array($flag, $flags, true);
    }
}

