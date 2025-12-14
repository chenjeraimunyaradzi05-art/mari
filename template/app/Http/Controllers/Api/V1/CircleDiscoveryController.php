<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\CircleDiscoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CircleDiscoveryController extends Controller
{
    protected CircleDiscoveryService $discoveryService;

    public function __construct(CircleDiscoveryService $discoveryService)
    {
        $this->discoveryService = $discoveryService;
    }

    /**
     * Discover users from a list of contacts.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function discover(Request $request): JsonResponse
    {
        $request->validate([
            'contacts' => 'required|array',
            'contacts.*.email' => 'nullable|email',
            'contacts.*.phone' => 'nullable|string',
            'contacts.*.name' => 'nullable|string',
        ]);

        $contacts = $request->input('contacts');
        $results = $this->discoveryService->discoverFromContacts($contacts);

        return response()->json([
            'message' => 'Discovery complete',
            'data' => [
                'matches' => $results['matches']->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'avatar_url' => $user->avatar_url,
                        'role' => $user->role_display_name,
                    ];
                }),
                'invites' => $results['invites'],
            ],
        ]);
    }
}

