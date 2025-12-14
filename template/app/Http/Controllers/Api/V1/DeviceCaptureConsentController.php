<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\DeviceCaptureConsentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DeviceCaptureConsentController extends Controller
{
    public function __construct(private readonly DeviceCaptureConsentService $consents)
    {
        $this->middleware(['auth:sanctum']);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'capture_type' => ['required', 'string', 'max:40'],
            'context' => ['nullable', 'string', 'max:120'],
            'consent_copy' => ['sometimes', 'string', 'max:500'],
        ]);

        $consent = $this->consents->record(
            $request->user(),
            $data['capture_type'],
            [
                'context' => $data['context'] ?? 'social_composer',
                'consent_copy' => $data['consent_copy'] ?? config('social.capture.consent_copy'),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]
        );

        return response()->json([
            'ok' => true,
            'data' => [
                'id' => $consent->getKey(),
                'capture_type' => $consent->capture_type,
                'reminded_at' => optional($consent->reminded_at)->toIso8601String(),
                'created_at' => optional($consent->created_at)->toIso8601String(),
            ],
        ]);
    }
}

