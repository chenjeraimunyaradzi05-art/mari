<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\StoreConversationRequest;
use App\Http\Resources\Messaging\ConversationResource;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use App\Services\Messaging\ConversationService;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class ConversationController extends Controller
{
    public function __construct(private ConversationService $service)
    {
    }

    public function index(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $profile = $this->resolveActiveProfile($request);
        $socialProfile = $this->resolveActiveSocialProfile($profile);
        $perPage = (int) ($validated['per_page'] ?? 20);

        $conversations = SocialThread::query()
            ->with(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments'])
            ->forProfile($socialProfile)
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->paginate($perPage);

        return ConversationResource::collection($conversations);
    }

    public function store(StoreConversationRequest $request): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);

        $activeSocialProfile = $this->resolveActiveSocialProfile($profile);

        $participantIds = collect($request->participantSocialProfileIds())
            ->reject(fn (int $socialId) => $socialId === $activeSocialProfile->getKey())
            ->values();

        if ($participantIds->isEmpty()) {
            throw ValidationException::withMessages([
                'participant_profile_ids' => ['Add at least one other profile to start a conversation.'],
            ]);
        }

        $participants = SocialProfile::query()
            ->whereIn('id', $participantIds)
            ->get();

        if ($participants->count() !== $participantIds->count()) {
            throw ValidationException::withMessages([
                'participant_social_profile_ids' => ['One or more selected profiles do not exist anymore.'],
            ]);
        }

        $conversation = $this->service->startConversation(
            $profile,
            $participants,
            $request->input('type'),
            (bool) $request->boolean('requires_approval', false),
            $request->input('subject'),
            $request->input('metadata'),
            $request->initialMessagePayload(),
            $request->input('request_mode')
        );

        return (new ConversationResource($conversation))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, SocialThread $conversation): ConversationResource
    {
        $this->authorize('view', $conversation);

        return new ConversationResource(
            $conversation->load(['participants.profile', 'lastMessage.sender', 'lastMessage.attachments'])
        );
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());

        abort_if(!$profile, 403, 'Select a persona before using messaging.');

        return $profile;
    }

    private function resolveActiveSocialProfile(Profile $profile): SocialProfile|null
    {
        $socialProfile = ActiveSocialProfile::forProfile($profile);

        abort_if(!$socialProfile, 403, 'Provision a social identity for this persona before messaging.');

        return $socialProfile;
    }
}

