<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\SocialIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SocialIntegrationController extends Controller
{
    public function __construct(private readonly SocialIntegrationService $integrations)
    {
        $this->middleware(['auth:sanctum']);
    }

    public function index(Request $request): JsonResponse
    {
        $providers = $this->integrations->forUser($request->user())->values();

        return response()->json([
            'ok' => true,
            'data' => $providers,
        ]);
    }

    public function connect(Request $request, string $provider): JsonResponse
    {
        $data = $request->validate([
            'handle' => ['nullable', 'string', 'max:120'],
            'access_token' => ['nullable', 'string', 'max:512'],
            'refresh_token' => ['nullable', 'string', 'max:512'],
            'expires_at' => ['nullable', 'date'],
            'auto_share' => ['sometimes', 'boolean'],
        ]);

        $integration = $this->integrations->connect($request->user(), $provider, $data);

        return response()->json([
            'ok' => true,
            'data' => [
                'provider' => $integration->provider,
                'status' => $integration->status,
                'connected_at' => optional($integration->connected_at)->toIso8601String(),
            ],
        ], 201);
    }

    public function disconnect(Request $request, string $provider): JsonResponse
    {
        $this->integrations->disconnect($request->user(), $provider);

        return response()->json([
            'ok' => true,
            'data' => [
                'provider' => $provider,
                'status' => 'disconnected',
            ],
        ]);
    }
}

