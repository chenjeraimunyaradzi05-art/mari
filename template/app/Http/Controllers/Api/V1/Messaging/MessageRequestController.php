<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Enums\SocialMessageRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Messaging\ConversationResource;
use App\Http\Resources\Messaging\MessageRequestResource;
use App\Models\Profile;
use App\Models\SocialMessageRequest;
use App\Models\SocialProfile;
use App\Services\Messaging\ConversationService;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class MessageRequestController extends Controller
{
    public function __construct(private readonly ConversationService $service)
    {
    }

    public function index(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $profile = $this->resolveActiveProfile($request);
        $socialProfile = $this->resolveActiveSocialProfile($profile);

        $validated = $request->validate([
            'status' => ['nullable', Rule::in(array_map(fn (SocialMessageRequestStatus $status) => $status->value, SocialMessageRequestStatus::cases()))],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $statusFilter = $validated['status'] ?? SocialMessageRequestStatus::Pending->value;
        $perPage = (int) ($validated['per_page'] ?? 20);

        $requests = SocialMessageRequest::query()
            ->with(['thread.lastMessage.sender', 'thread.participants.profile', 'requester'])
            ->where('target_social_profile_id', $socialProfile->getKey())
            ->when($statusFilter, fn ($query) => $query->where('status', $statusFilter))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return MessageRequestResource::collection($requests);
    }

    public function approve(Request $request, SocialMessageRequest $messageRequest): ConversationResource
    {
        $profile = $this->resolveActiveProfile($request);
        $thread = $this->service->approveRequest($messageRequest, $profile);

        return new ConversationResource(
            $thread->load(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments'])
        );
    }

    public function decline(Request $request, SocialMessageRequest $messageRequest): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->service->declineRequest($messageRequest, $profile);

        return response()->json([
            'id' => $messageRequest->getKey(),
            'status' => SocialMessageRequestStatus::Declined->value,
        ]);
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());

        abort_if(!$profile, 403, 'Select a persona before using message requests.');

        return $profile;
    }

    private function resolveActiveSocialProfile(Profile $profile): SocialProfile|null
    {
        $socialProfile = ActiveSocialProfile::forProfile($profile);

        abort_if(!$socialProfile, 403, 'Provision a social identity for this persona before opening the inbox.');

        return $socialProfile;
    }
}

