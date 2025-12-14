<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDreamJobAlertRequest;
use App\Http\Requests\UpdateDreamJobAlertRequest;
use App\Models\DreamJobAlert;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;

final class DreamJobAlertPageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $alerts = DreamJobAlert::query()->where('user_id', $user->id)->latest()->get();

        return view('dream_job_alerts.index', compact('alerts'));
    }

    public function create(Request $request)
    {
        return view('dream_job_alerts.create', ['alert' => new DreamJobAlert()]);
    }

    public function store(StoreDreamJobAlertRequest $request): RedirectResponse
    {
        $data = $request->validated();
        // Allow comma-separated skills from form input and normalize to array
        if (is_string($request->input('required_skills'))) {
            $skills = array_filter(array_map('trim', explode(',', $request->input('required_skills'))));
            $data['required_skills'] = $skills;
        }
        $data['user_id'] = $request->user()->id;

        DreamJobAlert::create($data);

        return Redirect::to('/dream-job-alerts/ui')->with('success', 'Alert created');
    }

    public function edit(Request $request, DreamJobAlert $dreamJobAlert)
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        return view('dream_job_alerts.edit', ['alert' => $dreamJobAlert]);
    }

    public function update(UpdateDreamJobAlertRequest $request, DreamJobAlert $dreamJobAlert): RedirectResponse
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        $data = $request->validated();
        if ($request->has('required_skills') && is_string($request->input('required_skills'))) {
            $data['required_skills'] = array_filter(array_map('trim', explode(',', $request->input('required_skills'))));
        }

        $dreamJobAlert->update($data);

        return Redirect::to('/dream-job-alerts/ui')->with('success', 'Alert updated');
    }

    public function destroy(Request $request, DreamJobAlert $dreamJobAlert): RedirectResponse
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        $dreamJobAlert->delete();

        return Redirect::to('/dream-job-alerts/ui')->with('success', 'Alert deleted');
    }

    private function authorizeOwnership(int $userId, DreamJobAlert $alert): void
    {
        if ($alert->user_id !== $userId) {
            abort(403, 'Not authorized to access this alert.');
        }
    }
}
