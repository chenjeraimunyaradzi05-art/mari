<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDreamJobAlertRequest;
use App\Http\Requests\UpdateDreamJobAlertRequest;
use App\Models\DreamJobAlert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DreamJobAlertController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $alerts = DreamJobAlert::query()->where('user_id', $user->id)->get();

        return response()->json($alerts);
    }

    public function store(StoreDreamJobAlertRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['user_id'] = $request->user()->id;

        $alert = DreamJobAlert::create($data);

        return response()->json($alert, 201);
    }

    public function show(Request $request, DreamJobAlert $dreamJobAlert): JsonResponse
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        return response()->json($dreamJobAlert);
    }

    public function update(UpdateDreamJobAlertRequest $request, DreamJobAlert $dreamJobAlert): JsonResponse
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        $dreamJobAlert->update($request->validated());

        return response()->json($dreamJobAlert);
    }

    public function destroy(Request $request, DreamJobAlert $dreamJobAlert): JsonResponse
    {
        $this->authorizeOwnership($request->user()->id, $dreamJobAlert);

        $dreamJobAlert->delete();

        return response()->json(null, 204);
    }

    private function authorizeOwnership(int $userId, DreamJobAlert $alert): void
    {
        if ($alert->user_id !== $userId) {
            abort(403, 'Not authorized to access this alert.');
        }
    }
}
