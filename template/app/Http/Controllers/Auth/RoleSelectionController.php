<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

final class RoleSelectionController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth']);
    }

    public function show(): RedirectResponse|View
    {
        /** @var User $user */
        $user = Auth::user();

        if ($user->onboarding_completed) {
            return redirect()->to($user->preferredDashboardRoute());
        }

        return view('auth.role-selection', [
            'user' => $user,
            'roles' => config('athena.roles', []),
            'pronouns' => config('athena.pronouns', []),
            'interests' => config('athena.interests', []),
            'locations' => config('athena.locations', []),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $roleKeys = array_keys(config('athena.roles', []));
        $interestKeys = array_keys(config('athena.interests', []));
        $locationKeys = array_keys(config('athena.locations', []));
        $pronounOptions = config('athena.pronouns', []);

        $validated = $request->validate([
            'primary_role' => ['required', 'string', 'in:'.implode(',', $roleKeys)],
            'secondary_roles' => ['nullable', 'array'],
            'secondary_roles.*' => ['string', 'in:'.implode(',', $roleKeys)],
            'pronouns' => ['nullable', 'string', 'in:'.implode(',', $pronounOptions)],
            'bio' => ['nullable', 'string', 'max:500'],
            'location' => ['nullable', 'string', 'in:'.implode(',', $locationKeys)],
            'phone' => ['nullable', 'string', 'max:20'],
            'interests' => ['nullable', 'array'],
            'interests.*' => ['string', 'in:'.implode(',', $interestKeys)],
        ]);

        $secondaryRoles = collect($validated['secondary_roles'] ?? [])
            ->filter(fn ($role) => $role !== $validated['primary_role'])
            ->unique()
            ->values()
            ->all();

        $interests = collect($validated['interests'] ?? [])
            ->unique()
            ->values()
            ->all();

        $user->fill([
            'primary_role' => $validated['primary_role'],
            'secondary_roles' => $secondaryRoles,
            'pronouns' => $validated['pronouns'] ?? $user->pronouns,
            'bio' => $validated['bio'] ?? $user->bio,
            'location' => $validated['location'] ?? $user->location,
            'phone' => $validated['phone'] ?? $user->phone,
            'interests' => $interests ?: ($user->interests ?? []),
            'first_login' => false,
            'onboarding_completed' => true,
            'onboarding_completed_at' => now(),
        ])->save();

        $user->updateProfileCompletion();

        return redirect()->to($user->preferredDashboardRoute())
            ->with('success', 'Welcome to Athena—your experience is now personalized.');
    }

    public function update(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $roleKeys = array_keys(config('athena.roles', []));

        $validated = $request->validate([
            'primary_role' => ['required', 'string', 'in:'.implode(',', $roleKeys)],
            'secondary_roles' => ['nullable', 'array'],
            'secondary_roles.*' => ['string', 'in:'.implode(',', $roleKeys)],
        ]);

        $secondaryRoles = collect($validated['secondary_roles'] ?? [])
            ->filter(fn ($role) => $role !== $validated['primary_role'])
            ->unique()
            ->values()
            ->all();

        $user->fill([
            'primary_role' => $validated['primary_role'],
            'secondary_roles' => $secondaryRoles,
        ])->save();

        $user->updateProfileCompletion();

        return back()->with('success', 'Your platform roles have been updated.');
    }
}

