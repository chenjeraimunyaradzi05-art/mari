<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Services\WomenRealEstate\WomenVerificationDryRunService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

final class WomenVerificationDryRunController extends Controller
{
    public function index(WomenVerificationDryRunService $dryRunService): View
    {
        return view('admin.verification.women.dry-run', [
            'recentAgents' => $this->recentAgents(),
            'lastResult' => session('dry_run_result'),
            'lastAgent' => session('dry_run_agent'),
            'regulatorStatuses' => $dryRunService->validRegulatorStatuses(),
        ]);
    }

    public function store(Request $request, WomenVerificationDryRunService $dryRunService): RedirectResponse
    {
        $validated = $request->validate([
            'agent' => ['nullable', 'string'],
            'lead_days' => ['nullable', 'integer', 'min:0'],
            'fraud_score' => ['nullable', 'numeric', 'between:0,1'],
            'regulator_status' => ['nullable', Rule::in($dryRunService->validRegulatorStatuses())],
        ]);

        $identifier = Arr::get($validated, 'agent');
        $fallbackNotice = null;

        if ($identifier !== null) {
            $agent = $dryRunService->resolveAgent($identifier, false);

            if ($agent === null) {
                $agent = $dryRunService->resolveAgent();

                if ($agent === null) {
                    return back()
                        ->withInput()
                        ->withErrors(['agent' => 'No women verified agents are available for the dry run.']);
                }

                $fallbackNotice = sprintf('Agent "%s" was not found. Running dry run against agent #%d instead.', $identifier, $agent->id);
            }
        } else {
            $agent = $dryRunService->resolveAgent();

            if ($agent === null) {
                return back()
                    ->withInput()
                    ->withErrors(['agent' => 'No women verified agents are available for the dry run.']);
            }
        }

        $leadDays = Arr::get($validated, 'lead_days');
        $fraudScore = Arr::get($validated, 'fraud_score');
        $regulatorStatus = Arr::get($validated, 'regulator_status');

        if ($leadDays === null) {
            $leadDays = 30;
        }

        $options = [
            'lead_days' => (int) $leadDays,
            'fraud_score' => $fraudScore !== null ? (float) $fraudScore : null,
            'regulator_status' => $regulatorStatus,
        ];

        $result = $dryRunService->run($agent, array_filter($options, static fn ($value) => $value !== null));

        $payload = [
            'dry_run_result' => $result,
            'dry_run_agent' => [
                'id' => $agent->id,
                'name' => $agent->user?->name,
                'email' => $agent->user?->email,
                'stage' => $agent->verification_stage?->value,
            ],
        ];

        if ($fallbackNotice !== null) {
            $payload['dry_run_notice'] = $fallbackNotice;
        }

        return back()->with($payload);
    }

    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, WomenVerifiedAgent>
     */
    private function recentAgents(): \Illuminate\Database\Eloquent\Collection
    {
        return WomenVerifiedAgent::query()
            ->with('user')
            ->latest('id')
            ->take(10)
            ->get();
    }
}

