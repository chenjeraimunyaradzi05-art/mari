<?php

namespace App\Jobs;

use App\Jobs\TranscodeUploadedMedia;
use App\Models\MediaUploadSession;
use App\Notifications\Social\MediaScanFailedNotification;
use App\Services\Social\MediaScanService;
use Throwable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Notification;

class ScanUploadedMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $mediaUploadSessionId)
    {
        $this->onQueue(config('social.queue.media_processing', 'social-media'));
    }

    private function notifyFailure(MediaUploadSession $session, Throwable $exception): void
    {
        $alertEmail = config('services.media_scan.alert_email');

        if (! $alertEmail) {
            return;
        }

        Notification::route('mail', $alertEmail)->notify(
            new MediaScanFailedNotification(
                $session->uuid,
                (int) $session->user_id,
                $session->media_type,
                $session->storage_path,
                $exception->getMessage()
            )
        );
    }

    public function handle(MediaScanService $scanner): void
    {
        $session = MediaUploadSession::find($this->mediaUploadSessionId);

        if (! $session) {
            return;
        }

        try {
            $result = $scanner->scan($session);

            $session->forceFill([
                'scan_status' => $result['status'] ?? 'unknown',
                'scan_verdict' => $result['verdict'] ?? ($result['status'] ?? 'unknown'),
                'scan_score' => $result['score'] ?? null,
                'scan_labels' => $result['labels'] ?? null,
                'scan_summary' => $result['summary'] ?? null,
                'scan_completed_at' => now(),
            ])->save();

            if (($result['verdict'] ?? null) === 'allow') {
                TranscodeUploadedMedia::dispatch($session->id);
            }
        } catch (Throwable $e) {
            $session->forceFill([
                'scan_status' => 'error',
                'scan_error' => $e->getMessage(),
                'scan_attempted_at' => now(),
            ])->save();

            $this->notifyFailure($session, $e);
        }
    }
}
