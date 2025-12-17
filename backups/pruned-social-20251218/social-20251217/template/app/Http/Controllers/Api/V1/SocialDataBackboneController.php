<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SocialDataBackboneService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SocialDataBackboneController extends Controller
{
    public function __construct(private SocialDataBackboneService $service)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $user->loadMissing('socialProfile');

        if (! $user->socialProfile) {
            return response()->json([
                'message' => 'Social profile not provisioned for this account yet.',
            ], 409);
        }

        $forceRefresh = $request->boolean('refresh');
        $payload = $this->service->build($user, $forceRefresh);

        return response()->json([
            'data' => $payload,
            'meta' => [
                'cache' => $this->service->getCacheMeta(),
            ],
        ]);
    }
}

