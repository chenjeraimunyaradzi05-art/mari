<?php

namespace App\Jobs\ProfileVerification;

use App\Models\ProfileVerification;
use App\Models\VerificationAudit;
use App\Services\ProfileVerificationSummaryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class GenerateVerificationSummaryJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(public readonly int $verificationId)
    {
        $this->afterCommit = true;
        $connection = config('profile_verification.queue_connection', config('queue.default'));
        if ($connection) {
            $this->onConnection($connection);
        }

        $queue = config('profile_verification.automation.summary.queue');
        if ($queue) {
            $this->onQueue($queue);
        }
    }

    public function handle(ProfileVerificationSummaryService $service): void
    {
        $verification = ProfileVerification::find($this->verificationId);

        if ($verification === null) {
            return;
        }

        $summary = $service->build($verification);

        VerificationAudit::create([
            'verification_id' => $verification->getKey(),
            'action' => 'ai.summary.generated',
            'ai_summary' => $summary,
        ]);
    }
}

