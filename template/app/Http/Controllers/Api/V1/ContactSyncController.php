<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContactSyncSession;
use App\Services\Social\ContactSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class ContactSyncController extends Controller
{
    public function __construct(private readonly ContactSyncService $service)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', 'string'],
        ]);

        try {
            $session = $this->service->start($request->user(), $data['provider']);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'provider' => [$exception->getMessage()],
            ]);
        }

        return response()->json([
            'ok' => true,
            'session' => [
                'id' => $session->getKey(),
                'provider' => $session->provider,
                'state_token' => $session->state_token,
                'auth_url' => $session->auth_url,
                'status' => $session->status,
            ],
        ], 201);
    }

    public function callback(ContactSyncSession $session, Request $request): JsonResponse
    {
        $this->authorizeOwnership($session, $request->user()->id);

        $data = $request->validate([
            'contacts' => ['required', 'array', 'min:1'],
            'contacts.*.email' => ['nullable', 'email'],
            'contacts.*.phone' => ['nullable', 'string', 'max:40'],
            'contacts.*.name' => ['nullable', 'string', 'max:120'],
        ]);

        $updated = $this->service->handleCallback($session, $data['contacts']);

        return response()->json([
            'ok' => true,
            'session' => [
                'id' => $updated->getKey(),
                'status' => $updated->status,
            ],
        ]);
    }

    public function suggestions(Request $request): JsonResponse
    {
        $suggestions = $this->service->suggestions($request->user(), (int) $request->integer('limit', 20));

        return response()->json([
            'ok' => true,
            'suggestions' => $suggestions,
        ]);
    }

    protected function authorizeOwnership(ContactSyncSession $session, int $userId): void
    {
        if ($session->user_id !== $userId) {
            abort(403, 'You are not authorized to update this session.');
        }
    }
}

