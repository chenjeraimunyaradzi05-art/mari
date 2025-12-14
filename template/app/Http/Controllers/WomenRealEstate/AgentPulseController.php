<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Services\WomenRealEstate\AgentPulseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AgentPulseController extends Controller
{
    public function __construct(private readonly AgentPulseService $pulseService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request): JsonResponse
    {
        $payload = $this->pulseService->snapshotFor($request->user());

        return response()->json($payload);
    }
}

