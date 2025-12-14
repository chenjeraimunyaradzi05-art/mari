<?php

namespace App\Services\Ai;

use App\Contracts\AI\TextModel;
use App\Models\SocialMedia;
use App\Support\SocialMediaStorage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/**
 * AI-powered video captioning and transcription service
 * Integrates FFmpeg for audio extraction and Whisper/OpenAI for transcription
 */
final class AIVideoCaptioningService
{
    private const VTT_HEADER = "WEBVTT\n\n";
    private const MAX_CAPTION_LENGTH = 84;
    private string $ffmpegPath;
    private ?string $whisperApiKey;

    public function __construct(?string $ffmpegPath = null, ?string $whisperApiKey = null)
    {
        $this->ffmpegPath = $ffmpegPath ?? (string) config('social.media.processing.ffmpeg', 'ffmpeg');
        // prefer explicit whisper key if set, fall back to AI OpenAI provider key
        $this->whisperApiKey = $whisperApiKey ?? (string) (config('ai.providers.openai.api_key') ?? config('services.openai.api_key')) ?: null;
    }

    /**
     * Generate captions for a video media asset
     *
     * @return (int|mixed|null|string)[]|null
     *
     * @psalm-return array{captions_path: string, captions_url: null|string, language: 'en'|mixed, duration: mixed|null, segments: int<0, max>}|null
     */
    public function generateCaptions(SocialMedia $media): array|null
    {
        if ($media->media_type !== 'video') {
            return null;
        }

        try {
            // Extract audio from video
            $audioPath = $this->extractAudio($media);
            if (!$audioPath) {
                Log::warning('Failed to extract audio from video', ['media_id' => $media->id]);
                return null;
            }

            // Transcribe audio using Whisper
            $transcription = $this->transcribeAudio($audioPath);
            if (!$transcription) {
                @unlink($audioPath);
                return null;
            }

            // Generate WebVTT captions
            $vttContent = $this->generateVTT($transcription);
            $captionsPath = $this->saveCaptions($media, $vttContent);

            // Clean up temporary audio file
            @unlink($audioPath);

            // Update media record with captions path
            $aiAnalysis = $media->ai_analysis ?? [];
            $aiAnalysis['captions_generated_at'] = now()->toIso8601String();
            $aiAnalysis['transcription_language'] = $transcription['language'] ?? 'en';
            $aiAnalysis['captions_path'] = $captionsPath;

            $media->update([
                'ai_analysis' => $aiAnalysis,
            ]);

            return [
                'captions_path' => $captionsPath,
                'captions_url' => SocialMediaStorage::url($captionsPath),
                'language' => $transcription['language'] ?? 'en',
                'duration' => $transcription['duration'] ?? null,
                'segments' => count($transcription['segments'] ?? []),
            ];

        } catch (\Throwable $e) {
            Log::error('Video captioning failed', [
                'media_id' => $media->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Extract audio from video file using FFmpeg
     *
     * @return null|string
     */
    private function extractAudio(SocialMedia $media): string|null
    {
        $disk = SocialMediaStorage::disk();
        $videoPath = SocialMediaStorage::normalize($media->file_path);

        if (!$videoPath || !$disk->exists($videoPath)) {
            return null;
        }

        // Create temp directory
        $tempDir = storage_path('app/tmp/video-captions');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $audioPath = $tempDir . '/' . Str::uuid() . '.mp3';

        // Get local path for video
        [$localVideoPath, $deleteAfter] = $this->resolveLocalPath($disk, $videoPath);
        if (!$localVideoPath) {
            return null;
        }

        try {
            $process = new Process([
                $this->ffmpegPath,
                '-i', $localVideoPath,
                '-vn',  // No video
                '-acodec', 'libmp3lame',
                '-ar', '16000',  // 16kHz sample rate (Whisper optimized)
                '-ac', '1',  // Mono
                '-b:a', '32k',  // Low bitrate for smaller file
                $audioPath,
            ]);

            $process->setTimeout(300);
            $process->run();

            if ($deleteAfter && is_file($localVideoPath)) {
                @unlink($localVideoPath);
            }

            if ($process->isSuccessful() && is_file($audioPath)) {
                return $audioPath;
            }

            Log::warning('FFmpeg audio extraction failed', [
                'error' => $process->getErrorOutput(),
            ]);

            return null;

        } catch (\Throwable $e) {
            if ($deleteAfter && is_file($localVideoPath)) {
                @unlink($localVideoPath);
            }

            Log::error('Audio extraction exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Transcribe audio using OpenAI Whisper API
     */
    private function transcribeAudio(string $audioPath): ?array
    {
        if (!$this->whisperApiKey) {
            return $this->fallbackTranscription();
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withToken($this->whisperApiKey)
                ->attach('file', file_get_contents($audioPath), basename($audioPath))
                ->post('https://api.openai.com/v1/audio/transcriptions', [
                    'model' => 'whisper-1',
                    'response_format' => 'verbose_json',
                    'timestamp_granularities' => ['segment'],
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('Whisper API transcription failed', [
                'status' => $response->status(),
                'error' => $response->body(),
            ]);

            return $this->fallbackTranscription();

        } catch (\Throwable $e) {
            Log::error('Whisper API exception', ['error' => $e->getMessage()]);
            return $this->fallbackTranscription();
        }
    }

    /**
     * Generate WebVTT caption file from transcription
     */
    private function generateVTT(array $transcription): string
    {
        $vtt = self::VTT_HEADER;

        $segments = $transcription['segments'] ?? [];

        foreach ($segments as $index => $segment) {
            $start = $segment['start'] ?? 0;
            $end = $segment['end'] ?? $start + 3;
            $text = $segment['text'] ?? '';

            // Format timestamps
            $startTime = $this->formatTimestamp($start);
            $endTime = $this->formatTimestamp($end);

            // Break long captions into multiple lines
            $lines = $this->wrapCaptionText($text);

            $vtt .= sprintf("%d\n", $index + 1);
            $vtt .= sprintf("%s --> %s\n", $startTime, $endTime);
            $vtt .= implode("\n", $lines) . "\n\n";
        }

        return $vtt;
    }

    /**
     * Save captions to storage
     */
    private function saveCaptions(SocialMedia $media, string $vttContent): string
    {
        $filename = pathinfo($media->file_path, PATHINFO_FILENAME) . '.vtt';
        $captionsPath = $this->buildCaptionsPath($filename);

        $disk = SocialMediaStorage::disk();
        $disk->put($captionsPath, $vttContent, [
            'visibility' => config('social.media.visibility', 'public'),
        ]);

        return $captionsPath;
    }

    /**
     * Format timestamp for WebVTT (HH:MM:SS.mmm)
     */
    private function formatTimestamp(float $seconds): string
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;
        $milliseconds = ($secs - floor($secs)) * 1000;

        return sprintf(
            '%02d:%02d:%02d.%03d',
            $hours,
            $minutes,
            floor($secs),
            $milliseconds
        );
    }

    /**
     * Wrap caption text to appropriate length
     *
     * @return string[]
     *
     * @psalm-return list{string,...}
     */
    private function wrapCaptionText(string $text): array
    {
        $text = trim($text);
        $lines = [];
        $words = explode(' ', $text);
        $currentLine = '';

        foreach ($words as $word) {
            $testLine = $currentLine === '' ? $word : $currentLine . ' ' . $word;

            if (strlen($testLine) <= self::MAX_CAPTION_LENGTH) {
                $currentLine = $testLine;
            } else {
                if ($currentLine !== '') {
                    $lines[] = $currentLine;
                }
                $currentLine = $word;
            }
        }

        if ($currentLine !== '') {
            $lines[] = $currentLine;
        }

        return $lines ?: [''];
    }

    /**
     * Build captions file path
     */
    private function buildCaptionsPath(string $filename): string
    {
        $paths = config('social.media.paths', []);
        $root = trim(config('social.media.root', 'social'), '/');
        $folder = trim($paths['captions'] ?? 'captions', '/');

        return implode('/', array_filter([$root, $folder, $filename]));
    }

    /**
     * Resolve local file path from disk
     *
     * @return (bool|null|string)[]
     *
     * @psalm-return list{null|string, bool}
     */
    private function resolveLocalPath(\Illuminate\Filesystem\FilesystemAdapter $disk, string $path): array
    {
        if (method_exists($disk, 'path')) {
            try {
                $absolute = $disk->path($path);
                if ($absolute && is_file($absolute)) {
                    return [$absolute, false];
                }
            } catch (\Throwable $e) {
                // Fall through to stream copy
            }
        }

        // Copy to temp location
        $tempPath = storage_path('app/tmp/video-captions/' . Str::uuid() . '.tmp');
        $tempDir = dirname($tempPath);

        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $stream = $disk->readStream($path);
        if ($stream === false) {
            return [null, false];
        }

        $destination = fopen($tempPath, 'wb');
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

        return [$tempPath, true];
    }

    /**
     * Fallback transcription when API unavailable
     *
     * @return ((float|string)[][]|null|string)[]
     *
     * @psalm-return array{language: 'en', duration: null, text: 'Transcription temporarily unavailable', segments: list{array{start: float, end: float, text: 'Transcription temporarily unavailable'}}}
     */
    private function fallbackTranscription(): array
    {
        return [
            'language' => 'en',
            'duration' => null,
            'text' => 'Transcription temporarily unavailable',
            'segments' => [
                [
                    'start' => 0.0,
                    'end' => 3.0,
                    'text' => 'Transcription temporarily unavailable',
                ],
            ],
        ];
    }
}

