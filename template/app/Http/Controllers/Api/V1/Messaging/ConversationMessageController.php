<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\SendConversationMessageRequest;
use App\Http\Resources\Messaging\ConversationMessageResource;
use App\Models\Profile;
use App\Models\SocialThread;
use App\Services\Messaging\ConversationService;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\Request;

final class ConversationMessageController extends Controller
{
    public function __construct(private ConversationService $service)
    {
    }

    public function index(Request $request, SocialThread $conversation): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $this->authorize('view', $conversation);

        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 30);

        $messages = $conversation->messages()
            ->with(['sender', 'attachments', 'reactions', 'reads'])
            ->orderByDesc('sent_at')
            ->paginate($perPage);

        $viewerSocial = ActiveSocialProfile::forUser($request->user(), false);

        if ($viewerSocial) {
            $this->service->markMessagesRead($conversation, $viewerSocial, $messages->items());
        }

        return ConversationMessageResource::collection($messages);
    }

    public function store(SendConversationMessageRequest $request, SocialThread $conversation): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->authorize('view', $conversation);

        // Build a payload that preserves nested uploaded files. We prefer the
        // validated input but ensure any UploadedFile instances embedded in
        // attachments are merged back into the payload so services see them.
        $validated = $request->validated();

        $attachments = $validated['attachments'] ?? $request->input('attachments', []);

        // Merge file uploads for nested attachments (attachments.0.upload etc.)
        foreach (($request->allFiles()['attachments'] ?? []) as $idx => $fileData) {
            if (!is_array($attachments)) {
                $attachments = [];
            }

            if (!array_key_exists($idx, $attachments) || !is_array($attachments[$idx])) {
                $attachments[$idx] = [];
            }

            if (isset($fileData['upload'])) {
                $attachments[$idx]['upload'] = $fileData['upload'];
            }
        }

        $payload = array_merge($validated, ['attachments' => $attachments]);

        $message = $this->service->sendMessage($conversation, $profile, $payload);

        return (new ConversationMessageResource($message))
            ->response()
            ->setStatusCode(201);
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());

        abort_if(!$profile, 403, 'Select a persona before using messaging.');

        return $profile;
    }
}

