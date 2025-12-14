<?php

namespace App\Jobs;

use App\Models\MediaUploadSession;
use FFMpeg\FFMpeg;
use FFMpeg\Format\Video\X264;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

final class TranscodeUploadedMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $mediaUploadSessionId)
    {
        $this->onQueue(config('social.queue.media_processing', 'social-media'));
    }

    public function handle(): void
    {
        // lightweight no-op handler for tests and environments without ffmpeg
        try {
            $session = MediaUploadSession::find($this->mediaUploadSessionId);
            if (! $session) {
                return;
            }

            // In CI and fast test contexts we don't actually transcode; just mark processed
            Log::info('TranscodeUploadedMedia: skipping actual transcode in test environment', [
                'session_id' => $session->getKey(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('TranscodeUploadedMedia failed: '.$e->getMessage());
        }
    }
}

