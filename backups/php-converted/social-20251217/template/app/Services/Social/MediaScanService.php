<?php

namespace App\Services\Social;

use App\Models\MediaUploadSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class MediaScanService
{
    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{status: 'skipped'|'unknown'|mixed, verdict: 'allow'|'unknown'|mixed, score: mixed|null, labels: array<never, never>|mixed, summary: 'Media scanning disabled.'|mixed|null, raw?: array<never, never>|mixed}
     */
    public function scan(MediaUploadSession $session): array
    {
        $config = config('services.media_scan', []);

        if (! ($config['enabled'] ?? false)) {
            Log::info('media.scan.skipped', [
                'session_uuid' => $session->uuid,
                'reason' => 'disabled',
            ]);

            return [
                'status' => 'skipped',
                'verdict' => 'allow',
                'score' => null,
                'labels' => [],
                'summary' => 'Media scanning disabled.',
            ];
        }

        $endpoint = rtrim((string) ($config['base_url'] ?? ''), '/');
        if ($endpoint === '') {
            throw new RuntimeException('Media scan service base URL is not configured.');
        }

        if (! $session->storage_path) {
            throw new RuntimeException('Media upload session is missing the final storage path.');
        }

        $disk = Storage::disk($session->storage_disk);
        if (! $disk->exists($session->storage_path)) {
            throw new RuntimeException('Uploaded media not found on the configured disk.');
        }

        $http = Http::timeout((int) ($config['timeout'] ?? 25))->acceptJson();
        if (! empty($config['api_key'])) {
            $http = $http->withToken($config['api_key']);
        }

        $stream = $disk->readStream($session->storage_path);
        if ($stream === false) {
            throw new RuntimeException('Unable to obtain a readable stream for media scanning.');
        }

        try {
            // pass the stream resource directly to avoid callable type warnings
            $response = $http->attach(
                'file',
                $stream,
                basename($session->storage_path)
            )->post($endpoint.'/scan', [
                'session_id' => $session->uuid,
                'user_id' => $session->user_id,
                'media_type' => $session->media_type,
                'mime_type' => $session->mime_type,
                'size' => $session->total_size,
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        if ($response->failed()) {
            throw new RuntimeException('Media scan service responded with status '.$response->status().'.');
        }

        $payload = $response->json() ?? [];

        $result = [
            'status' => $payload['status'] ?? 'unknown',
            'verdict' => $payload['verdict'] ?? ($payload['status'] ?? 'unknown'),
            'score' => $payload['score'] ?? null,
            'labels' => $payload['labels'] ?? [],
            'summary' => $payload['summary'] ?? null,
            'raw' => $payload,
        ];

        Log::info('media.scan.completed', [
            'session_uuid' => $session->uuid,
            'verdict' => $result['verdict'],
            'status' => $result['status'],
            'score' => $result['score'],
        ]);

        return $result;
    }
}

