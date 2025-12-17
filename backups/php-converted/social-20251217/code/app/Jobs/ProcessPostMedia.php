<?php

namespace App\Jobs;

use App\Models\SocialMedia;
use App\Support\SocialMediaStorage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Intervention\Image\Facades\Image;
use Symfony\Component\Process\Process as SymfonyProcess;

final class ProcessPostMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 180;

    public function __construct(public int $mediaId)
    {
        $this->onConnection(config('social.queue.connection', config('queue.default')));
        $this->onQueue(config('social.queue.media_processing', 'social-media'));
    }

    private function processImage(SocialMedia $media): void
    {
        $disk = SocialMediaStorage::disk();
        $path = SocialMediaStorage::normalize($media->file_path);

        if (! $path || ! $disk->exists($path)) {
            return;
        }

        $stream = $disk->readStream($path);

        if ($stream === false) {
            return;
        }

        try {
            $image = Image::make($stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        $thumbnailPath = $media->thumbnail_path ?? $this->thumbnailPathFrom($media->file_path);

        $thumbnail = (clone $image)->fit(640, 640, function ($constraint): void {
            $constraint->aspectRatio();
            $constraint->upsize();
        });

        $disk->put($thumbnailPath, (string) $thumbnail->encode('jpg', 85), [
            'visibility' => config('social.media.visibility', 'public'),
        ]);

        $media->forceFill(array_filter([
            'thumbnail_path' => $thumbnailPath,
            'width' => $image->width(),
            'height' => $image->height(),
            'file_size' => $this->resolveSize($disk, $path),
        ], fn ($value) => $value !== null))->save();
    }

    private function processVideo(SocialMedia $media): void
    {
        $disk = SocialMediaStorage::disk();
        $path = SocialMediaStorage::normalize($media->file_path);

        if (! $path || ! $disk->exists($path)) {
            return;
        }

        [$localPath, $deleteAfter] = $this->resolveLocalPath($disk, $path);

        if (! $localPath) {
            return;
        }

        $thumbnailPath = $media->thumbnail_path ?? $this->thumbnailPathFrom($media->file_path);
        $thumbnailTemp = $this->temporaryPath('jpg');

        try {
            $metadata = $this->probeVideo($localPath);

            if ($this->extractThumbnail($localPath, $thumbnailTemp)) {
                $this->persistThumbnail($disk, $thumbnailPath, $thumbnailTemp);
                $media->thumbnail_path = $thumbnailPath;
            }

            $updates = array_filter([
                'width' => $metadata['width'] ?? null,
                'height' => $metadata['height'] ?? null,
                'duration' => $metadata['duration'] ?? null,
                'file_size' => $this->resolveSize($disk, $path),
            ], fn ($value) => $value !== null);

            if (! empty($updates)) {
                $media->forceFill($updates)->save();
            }
        } finally {
            if (is_file($thumbnailTemp)) {
                @unlink($thumbnailTemp);
            }

            if ($deleteAfter && is_file($localPath)) {
                @unlink($localPath);
            }
        }
    }

    private function persistThumbnail(FilesystemAdapter $disk, string $thumbnailPath, string $thumbnailTemp): void
    {
        if (! is_file($thumbnailTemp)) {
            return;
        }

        $resource = fopen($thumbnailTemp, 'rb');

        if ($resource === false) {
            return;
        }

        try {
            $disk->put($thumbnailPath, $resource, [
                'visibility' => config('social.media.visibility', 'public'),
            ]);
        } finally {
            fclose($resource);
        }
    }

    /**
     * @return (bool|null|string)[]
     *
     * @psalm-return list{null|string, bool}
     */
    private function resolveLocalPath(FilesystemAdapter $disk, string $path): array
    {
        if (method_exists($disk, 'path')) {
            try {
                $absolute = $disk->path($path);

                if ($absolute && is_file($absolute)) {
                    return [$absolute, false];
                }
            } catch (\Throwable $exception) {
                Log::notice('Unable to resolve direct disk path, falling back to temp copy.', [
                    'path' => $path,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        $temporaryPath = $this->temporaryPath(pathinfo($path, PATHINFO_EXTENSION) ?: 'tmp');
        $stream = $disk->readStream($path);

        if ($stream === false) {
            return [null, false];
        }

        $destination = fopen($temporaryPath, 'wb');

        if ($destination === false) {
            if (is_resource($stream)) {
                fclose($stream);
            }

            return [null, false];
        }

        stream_copy_to_stream($stream, $destination);
        fclose($destination);

        if (is_resource($stream)) {
            fclose($stream);
        }

        return [$temporaryPath, true];
    }

    private function extractThumbnail(string $sourcePath, string $destination): bool
    {
        try {
            $process = new SymfonyProcess([
                config('social.media.processing.ffmpeg', 'ffmpeg'),
                '-y',
                '-ss', '00:00:01',
                '-i', $sourcePath,
                '-frames:v', '1',
                '-vf', sprintf('scale=%d:-1', $this->thumbnailWidth()),
                $destination,
            ]);

            $process->setTimeout(90);
            $process->run();

            if ($process->isSuccessful()) {
                return is_file($destination);
            }

            Log::warning('FFmpeg thumbnail extraction failed', [
                'media_id' => $this->mediaId,
                'error' => $process->getErrorOutput(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('FFmpeg command threw an exception', [
                'media_id' => $this->mediaId,
                'error' => $exception->getMessage(),
            ]);
        }

        return false;
    }

    /**
     * @return int[]
     *
     * @psalm-return array<'duration'|'height'|'width', int>
     */
    private function probeVideo(string $sourcePath): array
    {
        try {
            $process = new SymfonyProcess([
                config('social.media.processing.ffprobe', 'ffprobe'),
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height:format=duration',
                '-of', 'json',
                $sourcePath,
            ]);

            $process->setTimeout(30);
            $process->run();

            if (! $process->isSuccessful()) {
                return [];
            }

            $payload = json_decode($process->getOutput(), true);

            if (! is_array($payload)) {
                return [];
            }

            $duration = data_get($payload, 'format.duration');

            return array_filter([
                'width' => (int) data_get($payload, 'streams.0.width'),
                'height' => (int) data_get($payload, 'streams.0.height'),
                'duration' => $duration !== null ? (int) round((float) $duration) : null,
            ], fn ($value) => $value !== null);
        } catch (\Throwable $exception) {
            Log::notice('FFprobe metadata extraction failed', [
                'media_id' => $this->mediaId,
                'error' => $exception->getMessage(),
            ]);

            return [];
        }
    }

    private function resolveSize(FilesystemAdapter $disk, string $path): ?int
    {
        try {
            return $disk->size($path);
        } catch (\Throwable) {
            return null;
        }
    }

    private function thumbnailPathFrom(?string $path): string
    {
        $filename = pathinfo((string) $path, PATHINFO_FILENAME) ?: Str::uuid()->toString();

        return $this->buildPath('thumbnails', $filename.'-preview.jpg');
    }

    private function buildPath(string $bucket, string $filename): string
    {
        $paths = config('social.media.paths', []);
        $root = trim(config('social.media.root', 'social'), '/');
        $folder = trim($paths[$bucket] ?? $bucket, '/');
        $segments = array_filter([$root, $folder], fn ($segment) => $segment !== '');

        return trim(implode('/', $segments).'/'.$filename, '/');
    }

    /**
     * @psalm-return int<320, max>
     */
    private function thumbnailWidth(): int
    {
        return max(320, (int) config('social.media.processing.thumbnail_width', 720));
    }

    private function temporaryPath(string $extension): string
    {
        $directory = storage_path('app/tmp/social-media');

        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        return $directory.'/'.Str::uuid()->toString().'.'.$extension;
    }
}

