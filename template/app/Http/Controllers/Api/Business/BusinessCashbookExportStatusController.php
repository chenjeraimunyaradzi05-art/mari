<?php

namespace App\Http\Controllers\Api\Business;

use App\Http\Controllers\Controller;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class BusinessCashbookExportStatusController extends Controller
{
    public function __invoke(Request $request, string $jobId): JsonResponse
    {
        $userId = $request->user()->id;
        $metadata = Cache::get($this->cacheKey($jobId));

        if (! $metadata) {
            return response()->json([
                'job_id' => $jobId,
                'status' => 'pending',
                'download_url' => null,
            ]);
        }

        if (($metadata['user_id'] ?? null) !== $userId) {
            abort(404);
        }

        $status = $metadata['status'] ?? 'pending';

        $payload = [
            'job_id' => $jobId,
            'status' => $status,
            'format' => $metadata['format'] ?? null,
            'filters' => $metadata['filters'] ?? [],
            'queued_at' => $metadata['queued_at'] ?? null,
            'ready_at' => $metadata['ready_at'] ?? null,
            'expires_at' => $metadata['expires_at'] ?? null,
            'download_url' => null,
        ];

        if ($status === 'ready' && isset($metadata['disk'], $metadata['path'])) {
            $payload['download_url'] = $this->buildDownloadUrl(
                $metadata['disk'],
                $metadata['path'],
                $metadata['expires_at'] ?? null
            );
        }

        return response()->json($payload);
    }

    private function cacheKey(string $jobId): string
    {
        return sprintf('exports:business:%s', $jobId);
    }

    private function buildDownloadUrl(string $disk, string $path, ?string $expiresAt): ?string
    {
        $expiry = now()->addMinutes(10);

        if ($expiresAt) {
            $maxExpiry = Carbon::parse($expiresAt);
            if ($maxExpiry->lessThan($expiry)) {
                $expiry = $maxExpiry;
            }
        }

        /** @var FilesystemAdapter $filesystem */
        $filesystem = Storage::disk($disk);

        try {
            return $filesystem->temporaryUrl($path, $expiry);
        } catch (Throwable $e) {
            try {
                $url = $filesystem->url($path);

                if (! Str::startsWith($url, ['http://', 'https://'])) {
                    return url($url);
                }

                return $url;
            } catch (Throwable $fallbackException) {
                report($fallbackException);

                return null;
            }
        }
    }
}

