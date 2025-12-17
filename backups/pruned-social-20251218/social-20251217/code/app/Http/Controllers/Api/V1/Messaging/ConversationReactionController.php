<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\StoreMessageReactionRequest;
use App\Http\Resources\Messaging\ConversationMessageResource;
use App\Models\Profile;
use App\Models\SocialMessage;
use App\Models\SocialMessageReaction;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\Request;

final class ConversationReactionController extends Controller
{
    public function store(StoreMessageReactionRequest $request, SocialMessage $message): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->authorize('view', $message->thread);

        $socialProfile = ActiveSocialProfile::forProfile($profile);
        abort_if(!$socialProfile, 403, 'Provision a social identity before reacting.');

        SocialMessageReaction::updateOrCreate(
            [
                'social_message_id' => $message->getKey(),
                'social_profile_id' => $socialProfile->getKey(),
            ],
            [
                'emoji' => $request->input('emoji'),
            ]
        );

        $message->load(['sender', 'attachments', 'reactions']);

        return (new ConversationMessageResource($message))
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(Request $request, SocialMessage $message): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->authorize('view', $message->thread);

        $socialProfile = ActiveSocialProfile::forProfile($profile);
        abort_if(!$socialProfile, 403, 'Provision a social identity before reacting.');

        SocialMessageReaction::where('social_message_id', $message->getKey())
            ->where('social_profile_id', $socialProfile->getKey())
            ->delete();

        $message->load(['sender', 'attachments', 'reactions']);

        return (new ConversationMessageResource($message))
            ->response()
            ->setStatusCode(200);
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());
        abort_if(!$profile, 403, 'Select a persona before reacting.');

        return $profile;
    }
}

