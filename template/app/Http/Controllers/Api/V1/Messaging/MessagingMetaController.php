<?php

namespace App\Http\Controllers\Api\V1\Messaging;

use App\Http\Controllers\Controller;
use App\Services\Messaging\CdnHealthService;
use App\Support\Messaging\AttachmentTypes;
use App\Support\Messaging\ShareableTypes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MessagingMetaController extends Controller
{
    public function __construct(private CdnHealthService $cdnHealth)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $payload = [
            'updated_at' => config('messaging.meta_updated_at'),
            'shareable_types' => ShareableTypes::allowed(),
            'attachment_types' => [
                'allowed' => AttachmentTypes::allowed(),
                'constraints' => AttachmentTypes::definitions(),
            ],
            'cdn' => $this->cdnHealth->metrics(),
        ];

        $response = response()->json($payload);
        $response->setEtag(sha1(json_encode($payload)));
        $response->isNotModified($request);

        return $response;
    }
}

