<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MediaUploadSession;
use App\Services\Social\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class MediaUploadController extends Controller
{
    public function __construct(private readonly MediaUploadService $uploads)
    {
        $this->middleware(['auth:sanctum']);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'media_type' => ['required', 'string', 'max:40'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'total_size' => ['required', 'integer', 'min:1'],
            'chunk_size' => ['nullable', 'integer', 'min:1'],
            'total_chunks' => ['nullable', 'integer', 'min:1'],
        ]);

        $session = $this->uploads->startSession($user, $validated);

        return response()->json(['data' => $this->transformSession($session)], 201);
    }

    public function show(Request $request, MediaUploadSession $mediaUploadSession): JsonResponse
    {
        $this->authorizeSession($request, $mediaUploadSession);

        return response()->json(['data' => $this->transformSession($mediaUploadSession->fresh())]);
    }

    public function storeChunk(Request $request, MediaUploadSession $mediaUploadSession): JsonResponse
    {
        $this->authorizeSession($request, $mediaUploadSession);

        $validated = $request->validate([
            'chunk_index' => ['required', 'integer', 'min:1'],
            'chunk' => ['required', 'file'],
            'checksum' => ['sometimes', 'string', 'max:190'],
        ]);

        $this->uploads->storeChunk(
            $request->user(),
            $mediaUploadSession,
            $request->file('chunk'),
            (int) $validated['chunk_index'],
            $validated['checksum'] ?? null
        );

        return response()->json(['data' => $this->transformSession($mediaUploadSession->refresh())]);
    }

    public function complete(Request $request, MediaUploadSession $mediaUploadSession): JsonResponse
    {
        $this->authorizeSession($request, $mediaUploadSession);

        $validated = $request->validate([
            'checksum' => ['sometimes', 'string', 'max:190'],
            'thumbnail_path' => ['sometimes', 'string', 'max:512'],
            'meta' => ['sometimes', 'array'],
            'meta.width' => ['sometimes', 'integer', 'min:1'],
            'meta.height' => ['sometimes', 'integer', 'min:1'],
            'meta.duration' => ['sometimes', 'integer', 'min:1'],
        ]);

        $session = $this->uploads->completeSession($request->user(), $mediaUploadSession, $validated);

        return response()->json(['data' => $this->transformSession($session)], 202);
    }

    private function authorizeSession(Request $request, MediaUploadSession $session): void
    {
        abort_unless((int) $session->user_id === (int) $request->user()->id, 404);
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{id: string, status: string, media_type: string, mime_type: null|string, storage_disk: string, storage_path: null|string, thumbnail_path: null|string, total_size: int, uploaded_size: int, chunk_size: int, received_chunks: int, total_chunks: int, meta: array|null, completed_at: string, expires_at: string, created_at: string, updated_at: string, scan_status: string, scan_verdict: null|string, scan_score: int|null, scan_summary: null|string, scan_labels: array|null, scan_attempted_at: string, scan_completed_at: string, scan_error: null|string, download_url: null|string}
     */
    private function transformSession(MediaUploadSession $session): array
    {
        return [
            'id' => $session->uuid,
            'status' => $session->status,
            'media_type' => $session->media_type,
            'mime_type' => $session->mime_type,
            'storage_disk' => $session->storage_disk,
            'storage_path' => $session->storage_path,
            'thumbnail_path' => $session->thumbnail_path,
            'total_size' => $session->total_size,
            'uploaded_size' => $session->uploaded_size,
            'chunk_size' => $session->chunk_size,
            'received_chunks' => $session->received_chunks,
            'total_chunks' => $session->total_chunks,
            'meta' => $session->meta,
            'completed_at' => optional($session->completed_at)->toIso8601String(),
            'expires_at' => optional($session->expires_at)->toIso8601String(),
            'created_at' => optional($session->created_at)->toIso8601String(),
            'updated_at' => optional($session->updated_at)->toIso8601String(),
            'scan_status' => $session->scan_status,
            'scan_verdict' => $session->scan_verdict,
            'scan_score' => $session->scan_score,
            'scan_summary' => $session->scan_summary,
            'scan_labels' => $session->scan_labels,
            'scan_attempted_at' => optional($session->scan_attempted_at)->toIso8601String(),
            'scan_completed_at' => optional($session->scan_completed_at)->toIso8601String(),
            'scan_error' => $session->scan_error,
            'download_url' => $this->resolveUrl($session),
        ];
    }

    private function resolveUrl(MediaUploadSession $session): ?string
    {
        if (! $session->storage_path) {
            return null;
        }

        try {
            /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
            $disk = Storage::disk($session->storage_disk);

            return $disk->url($session->storage_path);
        } catch (\Throwable $exception) {
            return null;
        }
    }
}

