<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\StoreConversationShareRequest;
use App\Http\Resources\Messaging\ConversationMessageResource;
use App\Models\Profile;
use App\Models\SocialMessageShare;
use App\Models\SocialThread;
use App\Services\Messaging\ConversationService;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use App\Support\Messaging\ShareMetadataFormatter;
use Illuminate\Http\Request;

final class ConversationShareController extends Controller
{
    public function __construct(private ConversationService $service)
    {
    }

    public function store(StoreConversationShareRequest $request, SocialThread $conversation): \Illuminate\Http\JsonResponse
    {
        $profile = $this->resolveActiveProfile($request);
        $this->authorize('view', $conversation);

        $structuredBody = ShareMetadataFormatter::normalizeStructuredBody($request->input('structured_body'));

        $payload = [
            'message_type' => 'post_share',
            'shareable_type' => $request->input('shareable_type'),
            'shareable_id' => $request->input('shareable_id'),
            'body' => $request->input('caption'),
            'structured_body' => $structuredBody,
            'attachments' => $request->input('attachments', []),
        ];

        $message = $this->service->sendMessage($conversation, $profile, $payload);
        $message->loadMissing(['sender', 'attachments']);

        $socialProfile = ActiveSocialProfile::forProfile($profile);
        abort_if(!$socialProfile, 403, 'Provision a social identity before sharing.');

        $metadata = $request->input('metadata', []);

        if (!is_array($metadata)) {
            $metadata = [];
        }

        $shareMetadata = ShareMetadataFormatter::canonicalize($this->buildShareMetadata(
            $metadata,
            $request->input('caption'),
            $request->input('client'),
            $structuredBody
        ));

        SocialMessageShare::create([
            'shareable_type' => $request->input('shareable_type'),
            'shareable_id' => $request->input('shareable_id'),
            'source_social_profile_id' => $socialProfile->getKey(),
            'target_social_thread_id' => $conversation->getKey(),
            'status' => 'sent',
            'metadata' => $shareMetadata,
        ]);

        return (new ConversationMessageResource($message))
            ->response()
            ->setStatusCode(201);
    }

    private function resolveActiveProfile(Request $request): Profile|null
    {
        $profile = ActiveProfile::forUser($request->user());
        abort_if(!$profile, 403, 'Select a persona before sharing.');

        return $profile;
    }

    /**
     * @param array<string, mixed>  $metadata
     *
     * @return (array|mixed|string)[]
     *
     * @psalm-return array{caption?: mixed|string, client?: mixed|string, tags?: mixed, structured_body?: array|mixed,...}
     */
    private function buildShareMetadata(array $metadata, ?string $caption, ?string $client, ?array $structuredBody): array
    {
        $ordered = [];

        if ($caption !== null) {
            $ordered['caption'] = $caption;
        }

        if ($client !== null) {
            $ordered['client'] = $client;
        }

        if (array_key_exists('tags', $metadata)) {
            $ordered['tags'] = $metadata['tags'];
            unset($metadata['tags']);
        }

        if ($structuredBody !== null) {
            $ordered['structured_body'] = $structuredBody;
        }

        $extras = collect($metadata)
            ->except(['caption', 'client', 'structured_body'])
            ->toArray();

        return array_merge($ordered, $extras);
    }
}

