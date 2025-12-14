<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\LinkImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SocialImportController extends Controller
{
    public function __construct(private readonly LinkImportService $imports)
    {
        $this->middleware(['auth:sanctum']);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'links' => ['required', 'array'],
            'links.*' => ['string', 'max:5000'],
        ]);

        $result = $this->imports->importLinks($request->user(), $data['links']);

        return response()->json([
            'ok' => true,
            'job_id' => $result['job']->getKey(),
            'items' => $result['items'],
        ], 201);
    }
}

