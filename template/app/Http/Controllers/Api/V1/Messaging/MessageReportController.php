<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\ReportMessageRequest;
use App\Http\Resources\Messaging\MessageReportResource;
use App\Models\Profile;
use App\Models\SocialMessage;
use App\Services\Messaging\MessageReportService;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\Request;

final class MessageReportController extends Controller
{
    public function __construct(private readonly MessageReportService $service)
    {
    }

    public function store(ReportMessageRequest $request, SocialMessage $message): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->authorize('view', $message->thread);

        $socialProfile = ActiveSocialProfile::forProfile($profile);
        abort_if(!$socialProfile, 403, 'Provision a social identity before reporting.');

        $payload = $request->validated();

        $report = $this->service->report(
            $message,
            $profile,
            $socialProfile,
            $payload['reason'],
            $payload['notes'] ?? null,
            $payload['metadata'] ?? null
        );

        return (new MessageReportResource($report))
            ->response()
            ->setStatusCode(201);
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());

        abort_if(!$profile, 403, 'Select a persona before reporting.');

        return $profile;
    }
}

