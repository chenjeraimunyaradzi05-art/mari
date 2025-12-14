<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\Dashboards\RoleDashboardService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

final class RoleDashboardController extends Controller
{
    public function __construct(private RoleDashboardService $dashboardService)
    {
    }

    public function show(Request $request, ?string $role = null): View|RedirectResponse
    {
        $user = $request->user();

        // Default to 'candidate' if no primary purpose is set, to ensure the dashboard is functional for new users
        $role = $role ?? optional($user->primaryPurposeProfile)->primary_purpose ?? 'candidate';

        if (! $role) {
            abort(Response::HTTP_PRECONDITION_FAILED, 'Complete your purpose setup to access dashboards.');
        }

        // We allow the view if the role is valid, assuming the gate checks for specific permissions if needed.
        // If the gate is too strict for a default 'candidate' view, we might need to adjust it,
        // but for now we'll assume 'candidate' is accessible to authenticated users.
        Gate::authorize('dashboard.role.view', $role);

        $payload = $this->dashboardService->build($user, $role);

        return view('dashboards.role.index', [
            'dashboard' => $payload,
            'designReference' => config("dashboard_roles.roles.{$role}.design_reference"),
        ]);
    }
}

