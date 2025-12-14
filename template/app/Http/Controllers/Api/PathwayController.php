<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PathwayOrchestrator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PathwayController extends Controller
{
    protected $orchestrator;

    public function __construct(PathwayOrchestrator $orchestrator)
    {
        $this->orchestrator = $orchestrator;
    }

    public function index(Request $request): JsonResponse
    {
        $pathways = $this->orchestrator->getUserPathways($request->user());
        return response()->json($pathways);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'goal' => 'required|string',
            'constraints' => 'array',
        ]);

        $pathway = $this->orchestrator->createPathway(
            $request->user(),
            $request->input('goal'),
            $request->input('constraints', [])
        );

        return response()->json($pathway, 201);
    }
}

