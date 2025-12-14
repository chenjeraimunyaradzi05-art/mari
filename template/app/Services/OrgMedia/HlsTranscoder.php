<?php

namespace App\Services\OrgMedia;

use App\Models\OrgMediaAsset;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

final class HlsTranscoder
{
    public function transcode(OrgMediaAsset $asset): array
    {
        if (! config('org.hls.enabled')) {
            return [];
        }

        if ($asset->type !== 'video') {
            return [];
        }

        $disk = Storage::disk($asset->disk);
        $ffmpeg = config('org.hls.ffmpeg_binary', 'ffmpeg');
        $ffprobe = config('org.hls.ffprobe_binary', 'ffprobe');
        $segmentLength = (int) config('org.hls.segment_length', 6);
        $variants = config('org.hls.variants', []);

        if (empty($variants)) {
            throw new RuntimeException('No HLS variants configured.');
        }

        $tempDir = $this->createTempDirectory($asset->id);
        $sourcePath = $this->copySourceToLocal($disk, $asset->storage_path, $tempDir);
        $destinationBase = trim(config('org.hls.playlist_prefix', 'hls/org_media'), '/').'/'.$asset->id;

        $variantManifests = [];

        foreach ($variants as $variant) {
            $variantManifests[] = $this->encodeVariant(
                $ffmpeg,
                $segmentLength,
                $variant,
                $sourcePath,
                $tempDir
            );
        }

        $masterPlaylist = $this->createMasterPlaylist($variantManifests, $tempDir);
        $thumbnailLocalPath = $this->extractThumbnail($ffmpeg, $sourcePath, $tempDir);
        $captionsLocalPath = $this->ensurePlaceholderCaptions($tempDir);
        $duration = $this->probeDuration($ffprobe, $sourcePath);

        $storedPaths = $this->pushArtifactsToDisk(
            $disk,
            $tempDir,
            $destinationBase,
            $thumbnailLocalPath,
            $captionsLocalPath,
            $masterPlaylist
        );

        File::deleteDirectory($tempDir);

        return array_merge(
            [
                'playlist_path' => $storedPaths['playlist'],
                'variants' => $this->normalizeVariantMetadata($variantManifests),
                'duration' => $duration,
            ],
            Arr::only($storedPaths, ['thumbnail', 'captions'])
        );
    }

    private function createTempDirectory(int $assetId): string
    {
        $tempDir = storage_path('app/tmp/org_media/'.$assetId.'-'.Str::random(10));
        File::ensureDirectoryExists($tempDir);

        return $tempDir;
    }

    private function copySourceToLocal(Filesystem $disk, string $path, string $tempDir): string
    {
        $extension = pathinfo($path, PATHINFO_EXTENSION) ?: 'mp4';
        $localPath = $tempDir.'/source.'.$extension;

        try {
            $absolutePath = $disk->path($path);
            File::copy($absolutePath, $localPath);
        } catch (\Throwable $exception) {
            $contents = $disk->get($path);
            File::put($localPath, $contents);
        }

        return $localPath;
    }

    /**
     * @return (int|mixed|string)[]
     *
     * @psalm-return array{name: mixed, height: int, width: int, bitrate: int, audio_bitrate: int, playlist: string}
     */
    private function encodeVariant(string $ffmpeg, int $segmentLength, array $variant, string $sourcePath, string $tempDir): array
    {
        $name = $variant['name'];
        $height = (int) ($variant['height'] ?? 720);
        $videoBitrate = (int) ($variant['bitrate'] ?? 4500);
        $audioBitrate = (int) ($variant['audio_bitrate'] ?? 160);

        $variantPlaylist = $tempDir.'/'.$name.'.m3u8';
        $segmentPattern = $tempDir.'/'.$name.'_%03d.ts';
        $width = $this->estimateWidthFromHeight($height);

        $command = [
            $ffmpeg,
            '-y',
            '-i',
            $sourcePath,
            '-vf',
            'scale='.$width.':'.$height,
            '-c:v',
            'libx264',
            '-profile:v',
            'high',
            '-level',
            '4.1',
            '-b:v',
            $videoBitrate.'k',
            '-maxrate',
            (int) ($videoBitrate * 1.08).'k',
            '-bufsize',
            (int) ($videoBitrate * 2).'k',
            '-preset',
            'fast',
            '-c:a',
            'aac',
            '-b:a',
            $audioBitrate.'k',
            '-ac',
            '2',
            '-hls_time',
            $segmentLength,
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            $segmentPattern,
            $variantPlaylist,
        ];

        $this->runProcess($command, $tempDir);

        return [
            'name' => $name,
            'height' => $height,
            'width' => $width,
            'bitrate' => $videoBitrate,
            'audio_bitrate' => $audioBitrate,
            'playlist' => basename($variantPlaylist),
        ];
    }

    private function createMasterPlaylist(array $variantManifests, string $tempDir): string
    {
        $lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

        foreach ($variantManifests as $variant) {
            $bandwidth = (int) ($variant['bitrate'] * 1000);
            $resolution = $variant['width'].'x'.$variant['height'];

            $lines[] = '#EXT-X-STREAM-INF:BANDWIDTH='.$bandwidth.',RESOLUTION='.$resolution;
            $lines[] = $variant['playlist'];
        }

        $masterPath = $tempDir.'/master.m3u8';
        File::put($masterPath, implode("\n", $lines)."\n");

        return $masterPath;
    }

    private function extractThumbnail(string $ffmpeg, string $sourcePath, string $tempDir): string
    {
        $thumbnailPath = $tempDir.'/thumbnail.jpg';

        $command = [
            $ffmpeg,
            '-y',
            '-ss',
            '1',
            '-i',
            $sourcePath,
            '-frames:v',
            '1',
            '-vf',
            'scale=960:-2',
            $thumbnailPath,
        ];

        $this->runProcess($command, $tempDir);

        return $thumbnailPath;
    }

    private function ensurePlaceholderCaptions(string $tempDir): string
    {
        $captionsPath = $tempDir.'/captions.vtt';

        if (! File::exists($captionsPath)) {
            File::put($captionsPath, "WEBVTT\n\nNOTE Placeholder captions generated during transcoding\n");
        }

        return $captionsPath;
    }

    private function probeDuration(string $ffprobe, string $sourcePath): ?float
    {
        $command = [
            $ffprobe,
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            $sourcePath,
        ];

        try {
            $process = new Process($command);
            $process->setTimeout(120);
            $process->mustRun();

            $value = trim($process->getOutput());

            return is_numeric($value) ? (float) $value : null;
        } catch (\Throwable $exception) {
            Log::warning('Unable to probe media duration', [
                'source' => $sourcePath,
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return array{playlist: string, thumbnail?: string, captions?: string}
     */
    private function pushArtifactsToDisk(
        Filesystem $disk,
        string $tempDir,
        string $destinationBase,
        string $thumbnailLocalPath,
        string $captionsLocalPath,
        string $masterPlaylist
    ): array {
        $paths = [];

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($tempDir, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            /** @var \SplFileInfo $fileInfo */
            if ($fileInfo->isDir()) {
                continue;
            }

            $relative = Str::after($fileInfo->getPathname(), $tempDir);
            $relative = ltrim(str_replace('\\', '/', $relative), '/');
            $storagePath = trim($destinationBase.'/'.$relative, '/');

            $disk->put($storagePath, File::get($fileInfo->getPathname()));

            if ($fileInfo->getRealPath() === realpath($masterPlaylist)) {
                $paths['playlist'] = $storagePath;
            }

            if ($fileInfo->getRealPath() === realpath($thumbnailLocalPath)) {
                $paths['thumbnail'] = $storagePath;
            }

            if ($fileInfo->getRealPath() === realpath($captionsLocalPath)) {
                $paths['captions'] = $storagePath;
            }
        }

        if (! isset($paths['playlist'])) {
            throw new RuntimeException('HLS playlist missing after upload.');
        }

        return $paths;
    }

    /**
     * @return array[]
     *
     * @psalm-return array<array{name: mixed, height: mixed, width: mixed, bitrate: mixed, audio_bitrate: mixed, playlist: mixed}>
     */
    private function normalizeVariantMetadata(array $variants): array
    {
        return array_map(fn ($variant) => [
            'name' => $variant['name'],
            'height' => $variant['height'],
            'width' => $variant['width'],
            'bitrate' => $variant['bitrate'],
            'audio_bitrate' => $variant['audio_bitrate'],
            'playlist' => $variant['playlist'],
        ], $variants);
    }

    /**
     * @psalm-return int<640, max>
     */
    private function estimateWidthFromHeight(int $height): int
    {
        $width = (int) round(($height * 16) / 9);
        $width -= $width % 2;

        return max($width, 640);
    }

    private function runProcess(array $command, ?string $workingDirectory = null): void
    {
        $process = new Process($command, $workingDirectory);
        $process->setTimeout(900);

        try {
            $process->mustRun();
        } catch (\Throwable $exception) {
            Log::error('Media transcoding command failed', [
                'command' => implode(' ', array_map('strval', $command)),
                'error' => $exception->getMessage(),
            ]);

            throw new RuntimeException('Unable to process media asset. Ensure FFmpeg is installed and accessible.');
        }
    }
}

