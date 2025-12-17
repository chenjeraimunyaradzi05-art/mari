<?php

namespace App\Services\Social;

use App\Jobs\ScanUploadedMedia;
use App\Models\MediaUploadChunk;
use App\Models\MediaUploadSession;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class MediaUploadService
{
    public function startSession(User $user, array $payload): MediaUploadSession
    {
        $quota = $this->resolveQuota($user);
        $totalSize = max(0, (int) ($payload['total_size'] ?? 0));
        $chunkSize = max(0, (int) ($payload['chunk_size'] ?? $payload['chunk_bytes'] ?? 0));

        if ($totalSize <= 0) {
            throw ValidationException::withMessages([
                'total_size' => 'Total size must be provided for media uploads.',
            ]);
        }

        if ($chunkSize <= 0) {
            $chunkSize = $this->determineChunkSize($totalSize, $quota['chunk_bytes']);
        }

        if ($quota['max_bytes'] > 0 && $totalSize > $quota['max_bytes']) {
            throw ValidationException::withMessages([
                'total_size' => 'This upload exceeds the current allowance for your role.',
            ]);
        }

        if ($quota['chunk_bytes'] > 0 && $chunkSize > $quota['chunk_bytes']) {
            throw ValidationException::withMessages([
                'chunk_size' => 'Chunk size exceeds the configured limit.',
            ]);
        }

        $totalChunks = (int) ($payload['total_chunks'] ?? 0);
        if ($totalChunks <= 0 && $chunkSize > 0) {
            $totalChunks = (int) ceil($totalSize / $chunkSize);
        }

        $session = MediaUploadSession::create([
            'user_id' => $user->id,
            'media_type' => $payload['media_type'] ?? 'image',
            'mime_type' => $payload['mime_type'] ?? null,
            'storage_disk' => config('social.media.disk', config('filesystems.default', 'public')),
            'chunk_disk' => config('social.uploads.chunk_disk', 'local'),
            'total_size' => $totalSize,
            'chunk_size' => $chunkSize,
            'total_chunks' => $totalChunks,
            'role_quota_key' => $quota['key'],
        ]);

        return $session->fresh();
    }

    public function storeChunk(User $user, MediaUploadSession $session, UploadedFile $chunk, int $chunkIndex, ?string $checksum = null): MediaUploadChunk
    {
        $this->assertOwner($session, $user);
        $this->assertSessionActive($session);

        if ($chunkIndex < 1) {
            throw ValidationException::withMessages([
                'chunk_index' => 'Chunk index must be greater than zero.',
            ]);
        }

        if ($session->total_chunks > 0 && $chunkIndex > $session->total_chunks) {
            throw ValidationException::withMessages([
                'chunk_index' => 'Chunk index exceeds the declared total.',
            ]);
        }

        $quota = $this->quotaByKey($session->role_quota_key);
        $size = (int) $chunk->getSize();
        if ($size <= 0) {
            throw ValidationException::withMessages([
                'chunk' => 'Chunk upload cannot be empty.',
            ]);
        }

        if ($quota['chunk_bytes'] > 0 && $size > $quota['chunk_bytes']) {
            throw ValidationException::withMessages([
                'chunk' => 'Chunk size exceeds the configured limit.',
            ]);
        }

        $storedPath = $this->storeChunkFile($session, $chunk, $chunkIndex);
        $existing = $session->chunks()->where('chunk_index', $chunkIndex)->first();

        try {
            $result = DB::transaction(function () use ($session, $chunkIndex, $size, $checksum, $storedPath, $existing) {
                $attributes = [
                    'size' => $size,
                    'checksum' => $checksum,
                    'storage_path' => $storedPath,
                    'uploaded_at' => now(),
                ];

                if ($existing) {
                    $previousSize = (int) $existing->size;
                    $existing->fill($attributes)->save();
                    $delta = $size - $previousSize;
                    $chunkModel = $existing->fresh();
                } else {
                    $chunkModel = $session->chunks()->create(array_merge([
                        'chunk_index' => $chunkIndex,
                    ], $attributes));
                    $delta = $size;
                    $session->received_chunks = (int) $session->received_chunks + 1;
                }

                $session->uploaded_size = max(0, (int) $session->uploaded_size + $delta);
                $session->status = MediaUploadSession::STATUS_UPLOADING;
                $session->save();

                return $chunkModel;
            });
        } catch (\Throwable $exception) {
            Storage::disk($session->chunk_disk)->delete($storedPath);
            throw $exception;
        }

        if ($existing && $existing->storage_path !== $storedPath) {
            $this->deleteChunkFile($session, $existing->storage_path);
        }

        return $result;
    }

    public function completeSession(User $user, MediaUploadSession $session, array $payload = []): MediaUploadSession|null
    {
        $this->assertOwner($session, $user);
        $this->assertSessionActive($session);

        if ($session->received_chunks <= 0) {
            throw ValidationException::withMessages([
                'chunks' => 'Upload at least one chunk before completing the session.',
            ]);
        }

        if ($session->total_chunks > 0 && $session->received_chunks < $session->total_chunks) {
            throw ValidationException::withMessages([
                'chunks' => 'Not all chunks have been uploaded.',
            ]);
        }

        $session->status = MediaUploadSession::STATUS_PROCESSING;
        $session->save();

        $meta = array_filter($payload['meta'] ?? []);
        $finalPath = $this->finalizeUpload($session, $meta);

        $session->fill([
            'storage_path' => $finalPath,
            'meta' => $meta ? array_merge($session->meta ?? [], $meta) : $session->meta,
            'thumbnail_path' => $payload['thumbnail_path'] ?? $session->thumbnail_path,
            'checksum' => $payload['checksum'] ?? $session->checksum,
            'status' => MediaUploadSession::STATUS_COMPLETED,
            'completed_at' => now(),
            'error_message' => null,
            'scan_status' => 'pending',
            'scan_verdict' => null,
            'scan_score' => null,
            'scan_labels' => null,
            'scan_summary' => null,
            'scan_error' => null,
            'scan_attempted_at' => null,
            'scan_completed_at' => null,
        ])->save();

        ScanUploadedMedia::dispatch($session->id);

        return $session->fresh(['chunks']);
    }

    private function assertOwner(MediaUploadSession $session, User $user): void
    {
        if ((int) $session->user_id !== (int) $user->id) {
            abort(404);
        }
    }

    private function assertSessionActive(MediaUploadSession $session): void
    {
        if ($session->isComplete()) {
            throw ValidationException::withMessages([
                'session' => 'This upload has already been finalised.',
            ]);
        }

        if ($session->expires_at && $session->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'session' => 'This upload session has expired.',
            ]);
        }
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array{key: string,...}
     */
    private function resolveQuota(User $user): array
    {
        $candidates = [
            $user->primaryPurposeProfile?->primary_purpose,
            $user->primary_role,
            $user->role,
            'default',
        ];

        foreach ($candidates as $key) {
            if (! $key) {
                continue;
            }

            $quota = $this->quotaByKey($key);
            if ($quota) {
                $quota['key'] = $key;
                return $quota;
            }
        }

        $fallback = $this->quotaByKey('default');
        $fallback['key'] = 'default';

        return $fallback;
    }

    /**
     * @return (int|string)[]
     *
     * @psalm-return array{key: string, max_bytes: int, chunk_bytes: int}
     */
    private function quotaByKey(?string $key): array
    {
        $quotas = config('social.uploads.role_quotas', []);
        $reference = $key && isset($quotas[$key]) ? $quotas[$key] : ($quotas['default'] ?? ['max_bytes' => 2 * 1024 * 1024 * 1024, 'chunk_bytes' => 50 * 1024 * 1024]);

        $maxBytes = (int) ($reference['max_bytes'] ?? 2 * 1024 * 1024 * 1024);
        $chunkBytes = (int) ($reference['chunk_bytes'] ?? 50 * 1024 * 1024);

        return [
            'key' => $key ?? 'default',
            'max_bytes' => $maxBytes,
            'chunk_bytes' => $chunkBytes,
        ];
    }

    private function storeChunkFile(MediaUploadSession $session, UploadedFile $chunk, int $chunkIndex): string
    {
        $disk = Storage::disk($session->chunk_disk);
        $directory = trim('uploads/chunks/'.$session->uuid, '/');
        $filename = sprintf('%05d.part', $chunkIndex);

        $path = $disk->putFileAs($directory, $chunk, $filename);
        if (! $path) {
            throw new RuntimeException('Unable to persist chunk to temporary storage.');
        }

        return $path;
    }

    private function deleteChunkFile(MediaUploadSession $session, ?string $path): void
    {
        if (! $path) {
            return;
        }

        Storage::disk($session->chunk_disk)->delete($path);
    }

    private function finalizeUpload(MediaUploadSession $session, array $meta): string
    {
        $chunks = $session->chunks()->orderBy('chunk_index')->get();
        if ($chunks->isEmpty()) {
            throw ValidationException::withMessages([
                'chunks' => 'No chunks found for this upload.',
            ]);
        }

        $finalPath = $session->storage_path ?? $this->buildFinalPath($session, $meta);
        $finalDisk = Storage::disk($session->storage_disk);
        $visibility = config('social.media.visibility', 'public');

        $stream = fopen('php://temp', 'w+b');
        foreach ($chunks as $chunk) {
            $chunkStream = Storage::disk($session->chunk_disk)->readStream($chunk->storage_path);
            if (! $chunkStream) {
                fclose($stream);
                throw new RuntimeException('Failed to read chunk '.$chunk->chunk_index);
            }

            stream_copy_to_stream($chunkStream, $stream);
            fclose($chunkStream);
        }

        rewind($stream);

        if (! $finalDisk->put($finalPath, $stream, ['visibility' => $visibility])) {
            fclose($stream);
            throw new RuntimeException('Failed to persist merged upload.');
        }

        fclose($stream);
        $this->cleanupChunks($session, $chunks);

        return $finalPath;
    }

    private function buildFinalPath(MediaUploadSession $session, array $meta): string
    {
        $root = trim(config('social.media.root', 'social'), '/');
        $folderConfig = config('social.media.paths', []);
        $folder = $session->media_type === 'video'
            ? ($folderConfig['videos'] ?? 'posts/videos')
            : ($folderConfig['images'] ?? 'posts/images');

        $extension = $this->guessExtension($session->mime_type, $session->media_type);
        $datePath = now()->format('Y/m/d');

        return trim(sprintf('%s/%s/%s/%s.%s', $root, trim($folder, '/'), $datePath, $session->uuid, $extension), '/');
    }

    private function guessExtension(?string $mime, string $fallback = 'bin'): string
    {
        return match ($mime) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/ogg' => 'ogv',
            'audio/mpeg' => 'mp3',
            default => $fallback,
        };
    }

    private function cleanupChunks(MediaUploadSession $session, $chunks = null): void
    {
        $disk = Storage::disk($session->chunk_disk);
        $list = $chunks ?? $session->chunks;

        foreach ($list as $chunk) {
            $disk->delete($chunk->storage_path);
        }

        $session->chunks()->delete();
    }

    /**
     * @psalm-return int<1, max>
     */
    private function determineChunkSize(int $totalSize, int $quotaChunkBytes): int
    {
        $defaultChunk = (int) config('social.uploads.default_chunk_bytes', 50 * 1024 * 1024);
        $limit = $quotaChunkBytes > 0 ? $quotaChunkBytes : $defaultChunk;

        $size = $limit > 0 ? min($totalSize, $limit) : $totalSize;

        return max(1, $size);
    }
}

